import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = async (name) =>
  JSON.parse(
    await readFile(new URL(`../data/${name}`, import.meta.url), "utf8"),
  );
const recipes = await read("recipes.json");
const ingredients = await read("ingredients.json");

test("18 real recipes have traceable primary sources, original steps, quantities and editorial labels", () => {
  assert.equal(recipes.length, 18);
  assert.equal(new Set(recipes.map((item) => item.id)).size, 18);
  const ids = new Set(ingredients.map((item) => item.id));
  for (const recipe of recipes) {
    assert.ok(
      recipe.name &&
        recipe.name_en &&
        recipe.tags.length &&
        recipe.steps.length,
    );
    assert.ok(["简单", "进阶"].includes(recipe.difficulty));
    assert.ok(recipe.minutes > 0 && recipe.estimate_note.includes("估计"));
    assert.equal(recipe.source.checked_on, "2026-10-17");
    assert.equal(
      new URL(recipe.source.url).hostname,
      recipe.id === "gin-tonic" ? "sipsmith.com" : "iba-world.com",
    );
    assert.equal(
      new Set(recipe.ingredients.map((item) => item.id)).size,
      recipe.ingredients.length,
    );
    for (const item of recipe.ingredients) {
      assert.ok(ids.has(item.id));
      assert.equal(typeof item.optional, "boolean");
      assert.ok(item.unit);
      if (item.amount === null)
        assert.ok(item.amount_note, "Unquantified amount must be explained");
      else assert.ok(Number.isFinite(item.amount) && item.amount > 0);
      for (const alternative of item.alternatives)
        assert.ok(ids.has(alternative));
    }
  }
});

test("source-checked exact liquid quantities are protected against accidental changes", () => {
  // Manually recorded from the primary source URLs in data/SOURCES.md, not inferred from app output.
  const expected = {
    mojito: [45, 20],
    margarita: [50, 20, 15],
    daiquiri: [60, 20],
    "gin-tonic": [50, 150],
    negroni: [30, 30, 30],
    americano: [30, 30],
    "black-russian": [50, 20],
    "white-lady": [40, 30, 20],
    sidecar: [50, 20, 20],
    manhattan: [50, 20],
    "dry-martini": [60, 10],
    "cuba-libre": [50, 120, 10],
    "moscow-mule": [45, 120, 10],
    "tequila-sunrise": [45, 90, 15],
    "french-75": [30, 15, 15, 60],
    "espresso-martini": [50, 30, 10],
    boulevardier: [45, 30, 30],
    "old-fashioned": [45],
  };
  for (const recipe of recipes)
    assert.deepEqual(
      recipe.ingredients
        .filter((item) => item.unit === "ml")
        .map((item) => item.amount),
      expected[recipe.id],
      recipe.id,
    );
});

test("source-specific non-ml units remain intact and unspecified amounts are not made up", () => {
  const get = (id, key) =>
    recipes
      .find((recipe) => recipe.id === id)
      .ingredients.find((item) => item.id === key);
  assert.equal(get("mojito", "mint").amount, 6);
  assert.equal(get("mojito", "mint").unit, "枝");
  assert.equal(get("mojito", "white-sugar").unit, "茶匙");
  assert.equal(get("daiquiri", "white-sugar").unit, "吧匙");
  assert.equal(get("espresso-martini", "espresso").unit, "份");
  assert.equal(get("manhattan", "angostura").unit, "dash");
  assert.equal(get("mojito", "soda").amount, null);
  assert.equal(get("americano", "soda").amount, null);
  assert.equal(get("old-fashioned", "angostura").amount, null);
});
