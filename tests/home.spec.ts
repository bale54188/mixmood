import { expect, test } from "@playwright/test";

test("homepage calls compiled MoonBit and responds to mood and ingredient changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const moduleResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/src/generated/engine.mjs") &&
      response.status() === 200,
  );
  await page.goto("/");
  expect(await (await moduleResponse).text()).toContain("recommend_json");
  await expect(
    page.getByRole("heading", { name: "今晚是什么心情？" }),
  ).toBeVisible();
  await expect(page.locator(".mood-button")).toHaveCount(6);
  const first = page.locator(".recipe-card").first();
  await expect(first).toHaveAttribute("data-recipe-id", "mint-spark");
  await expect(first).toContainText("还需要：薄荷");
  await page.getByRole("button", { name: /甜蜜果香/ }).click();
  await expect(first).toHaveAttribute("data-recipe-id", "sunset-punch");
  await page.getByRole("button", { name: /清爽放松/ }).click();
  await page.getByRole("button", { name: "看看我的材料能调什么" }).click();
  await page.getByRole("checkbox", { name: "薄荷", exact: true }).check();
  await expect(first).toHaveAttribute("data-recipe-id", "mint-spark");
  await expect(first).toContainText("材料已齐");
  await expect(first).toContainText("所需材料均已选中");
  await page.getByRole("checkbox", { name: "薄荷", exact: true }).uncheck();
  await expect(first).toContainText("还需要：薄荷");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("browser executes the generated module with a new runtime-only recipe", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/generated/engine.mjs";
    const engine = await import(/* @vite-ignore */ modulePath);
    const catalog = [
      {
        id: "browser-probe",
        name: "Probe",
        description: "",
        tags: ["fresh"],
        ingredients: [{ id: "water", name: "水" }],
      },
    ];
    return JSON.parse(
      engine.recommend_json(JSON.stringify(catalog), '["water"]', '["fresh"]'),
    );
  });
  expect(result.engine).toBe("moonbit-js");
  expect(result.recommendations[0].recipe.id).toBe("browser-probe");
  expect(result.recommendations[0].can_make).toBe(true);
  expect(result.recommendations[0].missing).toEqual([]);
});

test("mobile layout has no horizontal overflow and the material entry works", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "今晚是什么心情？" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "看看我的材料能调什么" }).click();
  await expect(page.getByRole("checkbox", { name: "朗姆酒" })).toBeVisible();
  await expect(page.locator(".recipe-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
