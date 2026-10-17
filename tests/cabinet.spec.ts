import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const storageKey = "mixmood.inventory.v1";
let errors: string[];
test.beforeEach(async ({ page, context }) => {
  errors = [];
  const observe = (target: Page) => {
    target.on("pageerror", (error) => errors.push(error.message));
    target.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
  };
  observe(page);
  context.on("page", observe);
});
test.afterEach(() => expect(errors).toEqual([]));
const card = (page: Page, id: string) =>
  page.locator(`[data-recipe-id="${id}"]`);
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "看看我的材料能调什么" }).click();
}
async function add(page: Page, name: string) {
  await page.getByRole("searchbox", { name: "搜索材料" }).fill("");
  await page.getByRole("checkbox", { name, exact: true }).check();
}

test("fresh browser has unset inventory, no fabricated stock, and 18 traceable recipes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("inventory-summary")).toContainText(
    "还不了解你的酒柜",
  );
  await expect(page.locator(".availability.ready")).toHaveCount(0);
  await expect(page.locator(".recipe-card")).toHaveCount(18);
  await expect(card(page, "mojito")).toContainText("待录入材料");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull();
});

test("explicitly empty is persisted and remains different from unset after reload", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "我已确认没有材料" }).click();
  await expect(page.getByTestId("inventory-summary")).toContainText(
    "已确认没有材料",
  );
  await expect(card(page, "mojito")).toContainText("还差 6 种");
  await page.reload();
  await expect(page.getByTestId("inventory-summary")).toContainText(
    "已确认没有材料",
  );
  await expect(page.locator(".availability.ready")).toHaveCount(0);
  await page.getByRole("button", { name: "打开我的酒柜" }).click();
  await page.getByRole("button", { name: "重置为未录入" }).click();
  await expect(page.getByTestId("inventory-summary")).toContainText(
    "还不了解你的酒柜",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull();
});

test("Chinese and English search adds one canonical material, supports removal and no-result search", async ({
  page,
}) => {
  await open(page);
  const search = page.getByRole("searchbox", { name: "搜索材料" });
  await search.fill("lime");
  await page.getByRole("checkbox", { name: "青柠", exact: true }).check();
  await search.fill("青柠");
  await expect(
    page.getByRole("checkbox", { name: "青柠", exact: true }),
  ).toBeChecked();
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
  expect(stored.owned).toEqual(["lime"]);
  await page.getByRole("button", { name: "删除青柠" }).click();
  await expect(page.getByTestId("inventory-summary")).toContainText(
    "已确认没有材料",
  );
  await search.fill("不存在的原料");
  await expect(
    page.getByText("没有找到该材料。", { exact: false }),
  ).toBeVisible();
});

test("complete Gin & Tonic stays first even in tropical mood, and removal updates missing stock", async ({
  page,
}) => {
  await open(page);
  for (const name of ["金酒", "汤力水", "冰块"]) await add(page, name);
  await expect(card(page, "gin-tonic")).toContainText("主体材料已齐");
  await page.getByRole("button", { name: /热带度假/ }).click();
  await expect(page.locator(".recipe-card").first()).toHaveAttribute(
    "data-recipe-id",
    "gin-tonic",
  );
  await page.getByRole("button", { name: "删除汤力水" }).click();
  await expect(card(page, "gin-tonic")).toContainText("还差 1 种");
  await expect(card(page, "gin-tonic")).toContainText("还需要：汤力水");
});

test("cabinet survives closing and reopening a page in the same browser", async ({
  page,
  context,
}) => {
  await open(page);
  await add(page, "金酒");
  await add(page, "冰块");
  await page.close();
  const reopened = await context.newPage();
  await open(reopened);
  await expect(
    reopened.getByRole("checkbox", { name: "金酒", exact: true }),
  ).toBeChecked();
  await expect(
    reopened.getByRole("checkbox", { name: "冰块", exact: true }),
  ).toBeChecked();
  await expect(card(reopened, "gin-tonic")).toContainText("还需要：汤力水");
});

test("detail dialog shows source-backed amounts, notes and steps, supports Escape and restores focus", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "查看玛格丽特配方" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("50 ml");
  await expect(dialog).toContainText("20 ml");
  await expect(dialog).toContainText("15 ml");
  await expect(dialog.getByRole("heading", { name: "制作步骤" })).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: /International Bartenders/ }),
  ).toHaveAttribute("href", "https://iba-world.com/iba-cocktail/margarita/");
  await expect(dialog).toContainText("可选");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "查看莫吉托配方" }).click();
  await expect(page.getByRole("dialog")).toContainText("IBA 未提供毫升数");
  await page.getByRole("button", { name: "关闭配方" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("corrupt saved data falls back to unset without silently destroying the original record", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "{broken"),
    storageKey,
  );
  await open(page);
  await expect(
    page.getByText("无法读取酒柜记录，", { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId("inventory-summary")).toContainText(
    "还不了解你的酒柜",
  );
  await expect(page.locator(".availability.ready")).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe("{broken");
});

test("blocked localStorage reports saving failure while keeping the current interaction usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await open(page);
  await add(page, "金酒");
  await expect(
    page.getByText("浏览器阻止了保存。", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "金酒", exact: true }),
  ).toBeChecked();
  await expect(card(page, "gin-tonic")).toContainText("还需要：汤力水、冰块");
});

test("persisted aliases are normalized by MoonBit and unknown names never make a recipe complete", async ({
  page,
}) => {
  await page.addInitScript(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          status: "set",
          owned: ["GIN", "金酒", "汤力水", "冰块", "未知材料"],
        }),
      ),
    storageKey,
  );
  await open(page);
  await expect(
    page.getByRole("checkbox", { name: "金酒", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByText("未识别的记录未参与匹配：", { exact: false }),
  ).toContainText("未知材料");
  await expect(card(page, "gin-tonic")).toContainText("主体材料已齐");
  await expect(page.getByRole("button", { name: "删除金酒" })).toHaveCount(1);
});
