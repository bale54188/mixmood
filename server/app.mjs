import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { readConfig, interpret } from "./ai.mjs";
import { ApiError, validateInput } from "./preferences.mjs";

function json(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}
async function body(request) {
  const type = request.headers["content-type"]
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (type !== "application/json")
    throw new ApiError(415, "INVALID_CONTENT_TYPE", "请使用 JSON 请求。");
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 4096) {
        reject(new ApiError(413, "BODY_TOO_LARGE", "请求内容过长。"));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (size > 4096) return;
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new ApiError(400, "INVALID_JSON", "请求不是合法 JSON。"));
      }
    });
    request.on("error", () =>
      reject(new ApiError(400, "INVALID_JSON", "请求未完整发送。")),
    );
  });
}

export function createApp({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = 12_000,
  staticDir,
} = {}) {
  const config = readConfig(env);
  let active = 0;
  return createServer(
    { requestTimeout: 10_000, headersTimeout: 5000, maxHeaderSize: 8192 },
    async (request, response) => {
      try {
        const host = request.headers.host;
        const ports = [String(request.socket.localPort)];
        if (
          !["127.0.0.1", "localhost"].some((name) =>
            ports.some((port) => host === `${name}:${port}`),
          )
        ) {
          throw new ApiError(403, "INVALID_HOST", "不支持的请求来源。");
        }
        if (request.headers.origin) {
          let origin;
          try {
            origin = new URL(request.headers.origin);
          } catch {
            throw new ApiError(403, "INVALID_ORIGIN", "不支持的请求来源。");
          }
          if (
            !["127.0.0.1", "localhost"].includes(origin.hostname) ||
            origin.protocol !== "http:" ||
            ![...ports, "5173"].includes(origin.port)
          ) {
            throw new ApiError(403, "INVALID_ORIGIN", "不支持的请求来源。");
          }
        }
        const url = new URL(request.url, "http://127.0.0.1");
        if (url.pathname === "/api/ai/status" && request.method === "GET") {
          return json(response, 200, {
            configured: config.configured,
            message: config.configured
              ? "AI 已配置"
              : "AI 尚未配置。心情选择和我的酒柜仍可使用。",
          });
        }
        if (
          url.pathname === "/api/ai/preferences" &&
          request.method === "POST"
        ) {
          const text = validateInput(await body(request));
          if (active >= 2)
            throw new ApiError(
              429,
              "AI_BUSY",
              "正在处理其他请求，请稍后再试。",
            );
          active++;
          try {
            return json(response, 200, {
              preferences: await interpret(text, config, {
                fetchImpl,
                timeoutMs,
              }),
            });
          } finally {
            active--;
          }
        }
        if (url.pathname.startsWith("/api/"))
          throw new ApiError(404, "NOT_FOUND", "接口或请求方法不存在。");
        if (staticDir && ["GET", "HEAD"].includes(request.method)) {
          const root = resolve(staticDir);
          const relative = decodeURIComponent(url.pathname);
          const filename = resolve(root, "." + relative);
          if (
            relative.includes("\\") ||
            relative.includes("\0") ||
            relative.split("/").some((part) => part.startsWith(".")) ||
            (filename !== root && !filename.startsWith(root + sep))
          )
            throw new ApiError(404, "NOT_FOUND", "页面不存在。");
          const candidate =
            url.pathname === "/" ? resolve(root, "index.html") : filename;
          try {
            if (!(await stat(candidate)).isFile()) throw new Error("Not file");
            const types = {
              ".html": "text/html; charset=utf-8",
              ".js": "text/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
              ".svg": "image/svg+xml",
            };
            response.writeHead(200, {
              "Content-Type":
                types[extname(candidate)] ?? "application/octet-stream",
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "no-store",
            });
            return response.end(
              request.method === "HEAD" ? undefined : await readFile(candidate),
            );
          } catch {
            throw new ApiError(
              404,
              "NOT_FOUND",
              "页面不存在，请先运行生产构建。",
            );
          }
        }
        throw new ApiError(404, "NOT_FOUND", "页面不存在。");
      } catch (error) {
        const safe =
          error instanceof ApiError
            ? error
            : new ApiError(500, "INTERNAL_ERROR", "服务暂时不可用。");
        if (!response.headersSent && !response.destroyed)
          json(response, safe.status, {
            error: { code: safe.code, message: safe.message },
          });
        else response.destroy();
      }
    },
  );
}
