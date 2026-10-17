import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const input = (page: Page) =>
  page.getByRole("textbox", { name: "今晚的心情与口味" });
const button = (page: Page) =>
  page.getByRole("button", { name: "帮我找一杯", exact: true });
const prefs = {
  flavors: ["bitter"],
  difficulty: "intermediate",
  description: "微苦、可接受进阶",
};
async function configured(page: Page) {
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({ json: { configured: true } }),
  );
}
test("unconfigured AI is honest, sends no request and leaves original flows usable", async ({
  page,
}) => {
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({ json: { configured: false } }),
  );
  let calls = 0;
  await page.route("**/api/ai/preferences", (route) => {
    calls++;
    return route.abort();
  });
  await page.goto("/");
  await expect(
    page.getByText("AI 尚未配置。心情选择和我的酒柜仍可正常使用。"),
  ).toBeVisible();
  await input(page).fill("清爽一点");
  await expect(button(page)).toBeDisabled();
  await page.getByRole("button", { name: /成熟微苦/ }).click();
  await expect(page.locator('.mood-button[aria-pressed="true"]')).toContainText(
    "成熟微苦",
  );
  await page.getByRole("button", { name: "看看我的材料能调什么" }).click();
  await expect(page.getByRole("searchbox", { name: "搜索材料" })).toBeVisible();
  expect(calls).toBe(0);
});

test("AI success submits text only, shows loading, and uses real MoonBit difficulty ranking without inventing stock", async ({
  page,
}) => {
  await configured(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let payload: unknown;
  await page.route("**/api/ai/preferences", async (route) => {
    payload = route.request().postDataJSON();
    await gate;
    await route.fulfill({ json: { preferences: prefs } });
  });
  await page.goto("/");
  const text = "今天累了，想喝一杯微苦的，可以进阶一点。";
  await input(page).fill(text);
  await button(page).click();
  await expect(
    page.getByRole("button", { name: "正在理解你的心情…" }),
  ).toBeDisabled();
  release();
  await expect(page.getByTestId("ai-preferences")).toContainText(
    "微苦、可接受进阶",
  );
  expect(payload).toEqual({ text });
  const firstId = await page
    .locator(".recipe-card")
    .first()
    .getAttribute("data-recipe-id");
  expect(firstId).toBe("manhattan");
  await expect(page.locator(".availability.ready")).toHaveCount(0);
  await expect(page.getByTestId("inventory-summary")).toContainText(
    "还不了解你的酒柜",
  );
  await expect(page.locator('.mood-button[aria-pressed="true"]')).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /清爽放松/ }).click();
  await expect(page.getByTestId("ai-preferences")).toHaveCount(0);
  await expect(page.locator('.mood-button[aria-pressed="true"]')).toContainText(
    "清爽放松",
  );
});

test("AI preference sorting keeps a complete Gin & Tonic ahead of harder unavailable recipes", async ({
  page,
}) => {
  await configured(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mixmood.inventory.v1",
      JSON.stringify({
        version: 1,
        status: "set",
        owned: ["gin", "tonic", "ice"],
      }),
    ),
  );
  await page.route("**/api/ai/preferences", (route) =>
    route.fulfill({ json: { preferences: prefs } }),
  );
  await page.goto("/");
  await input(page).fill("微苦，可以进阶。");
  await button(page).click();
  await expect(page.getByTestId("ai-preferences")).toBeVisible();
  await expect(page.locator(".recipe-card").first()).toHaveAttribute(
    "data-recipe-id",
    "gin-tonic",
  );
  await expect(page.locator(".recipe-card").first()).toContainText(
    "主体材料已齐",
  );
});

test("request errors and invalid successful responses show errors without replacing recommendations", async ({
  page,
}) => {
  await configured(page);
  let invalid = false;
  await page.route("**/api/ai/preferences", (route) =>
    route.fulfill(
      invalid
        ? { json: { preferences: { ...prefs, flavors: ["sour"] } } }
        : { status: 504, json: { error: { code: "AI_TIMEOUT" } } },
    ),
  );
  await page.goto("/");
  const original = await page
    .locator(".recipe-card")
    .first()
    .getAttribute("data-recipe-id");
  await input(page).fill("清爽简单");
  await button(page).click();
  await expect(page.getByRole("alert")).toContainText("AI 请求超时");
  await expect(page.locator(".recipe-card").first()).toHaveAttribute(
    "data-recipe-id",
    original!,
  );
  invalid = true;
  await button(page).click();
  await expect(page.getByRole("alert")).toContainText("不支持的偏好");
  await expect(page.getByTestId("ai-preferences")).toHaveCount(0);
});

test("switching moods cancels an in-flight AI result rather than applying it late", async ({
  page,
}) => {
  await configured(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/ai/preferences", async (route) => {
    await gate;
    await route.fulfill({ json: { preferences: prefs } }).catch(() => {});
  });
  await page.goto("/");
  await input(page).fill("微苦，进阶");
  await button(page).click();
  await expect(
    page.getByRole("button", { name: "正在理解你的心情…" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /甜蜜果香/ }).click();
  release();
  await expect(page.locator('.mood-button[aria-pressed="true"]')).toContainText(
    "甜蜜果香",
  );
  await expect(page.getByTestId("ai-preferences")).toHaveCount(0);
  await expect(button(page)).toBeEnabled();
});

test("unreachable status is distinct from missing configuration and can be checked again", async ({
  page,
}) => {
  let ready = false;
  await page.route("**/api/ai/status", (route) =>
    ready ? route.fulfill({ json: { configured: true } }) : route.abort(),
  );
  await page.goto("/");
  await expect(
    page.getByText("AI 服务未连接。", { exact: false }),
  ).toBeVisible();
  ready = true;
  await page.getByRole("button", { name: "重新检查连接" }).click();
  await input(page).fill("清新");
  await expect(button(page)).toBeEnabled();
});

test("AI input remains usable on mobile without horizontal overflow", async ({
  page,
}) => {
  await configured(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(button(page)).toBeDisabled();
  await input(page).fill("酸甜清爽，简单一点");
  await expect(button(page)).toBeEnabled();
  await expect(input(page)).toHaveAttribute("maxlength", "600");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
