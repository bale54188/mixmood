import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const api = spawn(process.execPath, ["server/index.mjs"], {
  cwd: root,
  stdio: "inherit",
});
const vite = spawn(process.execPath, ["../node_modules/vite/bin/vite.js"], {
  cwd: fileURLToPath(new URL("../web/", import.meta.url)),
  stdio: "inherit",
});
const children = [api, vite];
let closing = false;
function close(code) {
  if (closing) return;
  closing = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill();
}
for (const child of children) {
  child.on("error", () => {
    console.error("MixMood 开发服务启动失败。");
    close(1);
  });
  child.on("exit", (code) => close(code ?? 1));
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => close(0));
