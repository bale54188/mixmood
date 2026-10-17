import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";

try {
  loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") {
    console.error("无法加载服务端 .env 文件，请检查文件格式与权限。");
    process.exit(1);
  }
}
const app = createApp({
  staticDir: fileURLToPath(new URL("../web/dist", import.meta.url)),
});
app.on("error", () => {
  console.error("MixMood API 启动失败，请检查 3001 端口是否被占用。");
  process.exitCode = 1;
});
app.listen(3001, "127.0.0.1", () =>
  console.log("MixMood server: http://127.0.0.1:3001"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => app.close(() => process.exit(0)));
