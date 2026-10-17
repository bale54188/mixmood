import contract from "../../data/preferences.json";

export interface AiPreferences {
  flavors: string[];
  difficulty: "any" | "easy" | "intermediate";
  description: string;
}
export async function checkAi(signal: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/ai/status", {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error("AI 服务暂未连接。请确认本地服务端已启动。");
  const value = await response.json();
  if (typeof value?.configured !== "boolean")
    throw new Error("AI 状态返回格式错误。");
  return value.configured;
}
export async function parseMood(
  text: string,
  signal: AbortSignal,
): Promise<AiPreferences> {
  const response = await fetch("/api/ai/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(18_000)]),
    body: JSON.stringify({ text }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("AI 服务返回格式错误，请重试。");
  }
  if (!response.ok) {
    const messages: Record<string, string> = {
      AI_NOT_CONFIGURED:
        "AI 尚未配置。请配置服务端后重启，原有心情与酒柜功能仍可使用。",
      AI_TIMEOUT: "AI 请求超时，请重试。",
      INVALID_AI_RESPONSE: "AI 返回的偏好格式不正确，请重试。",
      PERSONAL_INFORMATION: "请去除个人信息，只描述心情和口味。",
      INVALID_INPUT: "请输入 1–600 字的心情或口味描述。",
      AI_BUSY: "正在处理其他请求，请稍后重试。",
    };
    throw new Error(
      messages[data?.error?.code] ??
        "AI 请求失败，请稍后重试；原有推荐仍可使用。",
    );
  }
  const value = data?.preferences;
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).sort().join(",") !== "description,difficulty,flavors" ||
    !Array.isArray(value.flavors) ||
    !value.flavors.every(
      (tag: unknown) =>
        typeof tag === "string" &&
        contract.flavors.some((item) => item.id === tag),
    ) ||
    !contract.difficulties.some((item) => item.id === value.difficulty) ||
    typeof value.description !== "string" ||
    value.description.length > 160
  ) {
    throw new Error("AI 返回了不支持的偏好，请重试。");
  }
  return value as AiPreferences;
}
