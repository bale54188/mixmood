import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { root, runMoon } from "./moon.mjs";

runMoon(["build", "--target", "js", "--release", "--deny-warn"]);
const destination = resolve(root, "web/src/generated/engine.mjs");
mkdirSync(resolve(root, "web/src/generated"), { recursive: true });
copyFileSync(
  resolve(root, "engine/_build/js/release/build/mixmood.js"),
  destination,
);
console.log("MoonBit ESM → web/src/generated/engine.mjs");
