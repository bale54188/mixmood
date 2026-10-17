import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));

export function runMoon(args) {
  // Fresh terminals use PATH; the fallback also works in a previously opened Codex session.
  const local = resolve(
    homedir(),
    ".moon",
    "bin",
    process.platform === "win32" ? "moon.exe" : "moon",
  );
  const executable = existsSync(local) ? local : "moon";
  const result = spawnSync(executable, args, {
    cwd: resolve(root, "engine"),
    stdio: "inherit",
  });
  if (result.error)
    throw new Error(`MoonBit unavailable: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
