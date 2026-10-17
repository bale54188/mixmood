import type { Inventory } from "./engine";

export const INVENTORY_KEY = "mixmood.inventory.v1";
export const unsetInventory = (): Inventory => ({ status: "unset", owned: [] });

export function loadInventory(): { inventory: Inventory; warning: string } {
  try {
    const text = localStorage.getItem(INVENTORY_KEY);
    if (text === null) return { inventory: unsetInventory(), warning: "" };
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object") throw new Error("Invalid storage");
    const item = value as Record<string, unknown>;
    if (
      item.version !== 1 ||
      item.status !== "set" ||
      !Array.isArray(item.owned) ||
      !item.owned.every((id) => typeof id === "string")
    )
      throw new Error("Invalid storage");
    return { inventory: { status: "set", owned: item.owned }, warning: "" };
  } catch {
    return {
      inventory: unsetInventory(),
      warning:
        "无法读取酒柜记录，暂按未录入处理。请重新录入材料；旧记录不会被自动覆盖。",
    };
  }
}

export function saveInventory(inventory: Inventory): string {
  try {
    if (inventory.status === "unset") localStorage.removeItem(INVENTORY_KEY);
    else
      localStorage.setItem(
        INVENTORY_KEY,
        JSON.stringify({ version: 1, ...inventory }),
      );
    return "";
  } catch {
    return "浏览器阻止了保存。材料仅保留在当前页面，关闭后可能丢失；请允许此网站使用本地存储。";
  }
}
