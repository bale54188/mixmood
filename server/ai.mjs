import { ApiError, systemPrompt, validatePreferences } from "./preferences.mjs";

export function readConfig(env = process.env) {
  const names = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"];
  if (
    names.some(
      (name) =>
        !env[name]?.trim() ||
        /replace-with-|provider\.example/i.test(env[name]),
    )
  )
    return { configured: false };
  try {
    const base = new URL(env.AI_BASE_URL.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (
      (base.protocol !== "https:" && !(base.protocol === "http:" && local)) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      /[\r\n]/.test(env.AI_API_KEY + env.AI_MODEL) ||
      env.AI_MODEL.length > 200
    )
      return { configured: false };
    return {
      configured: true,
      endpoint: base.href.replace(/\/+$/, "") + "/chat/completions",
      apiKey: env.AI_API_KEY.trim(),
      model: env.AI_MODEL.trim(),
    };
  } catch {
    return { configured: false };
  }
}

export async function interpret(
  text,
  config,
  { fetchImpl = fetch, timeoutMs = 12_000 } = {},
) {
  if (!config.configured)
    throw new ApiError(
      503,
      "AI_NOT_CONFIGURED",
      "AI 尚未配置，请设置服务端环境变量后重启。心情选择和酒柜仍可使用。",
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        stream: false,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ApiError(
        502,
        "AI_UPSTREAM_ERROR",
        "AI 服务暂时不可用，请稍后重试。",
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new ApiError(
        502,
        "INVALID_AI_RESPONSE",
        "AI 返回了空响应，请重试。",
      );
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65_536) {
        await reader.cancel();
        throw new ApiError(502, "INVALID_AI_RESPONSE", "AI 响应过长，请重试。");
      }
      chunks.push(Buffer.from(value));
    }
    let result;
    try {
      result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ApiError(
        502,
        "INVALID_AI_RESPONSE",
        "AI 服务返回格式错误，请重试。",
      );
    }
    const choice = result?.choices?.[0];
    if (
      !choice ||
      choice.finish_reason !== "stop" ||
      typeof choice.message?.content !== "string" ||
      choice.message.refusal
    ) {
      throw new ApiError(
        502,
        "INVALID_AI_RESPONSE",
        "AI 未完成有效的偏好解析，请重试。",
      );
    }
    return validatePreferences(choice.message.content);
  } catch (error) {
    if (controller.signal.aborted)
      throw new ApiError(
        504,
        "AI_TIMEOUT",
        "AI 请求超时，请重试。原有推荐仍可使用。",
      );
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      "AI_UPSTREAM_ERROR",
      "无法连接 AI 服务，请稍后重试。",
    );
  } finally {
    clearTimeout(timer);
  }
}
