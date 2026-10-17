import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recommend_inventory_json } from "../web/src/generated/engine.mjs";
const read = async (name) =>
  JSON.parse(
    await readFile(new URL(`../data/${name}`, import.meta.url), "utf8"),
  );
const recipes = await read("recipes.json");
const materials = await read("ingredients.json");
const run = (
  owned = [],
  tags = [],
  status = "set",
  catalog = recipes,
  definitions = materials,
) =>
  JSON.parse(
    recommend_inventory_json(
      JSON.stringify(catalog),
      JSON.stringify({ status, owned }),
      JSON.stringify(tags),
      JSON.stringify(definitions),
    ),
  );
const find = (result, id) =>
  result.recommendations.find((item) => item.recipe_id === id);

test("M2 unset and explicitly empty inventories remain distinguishable over the actual ESM boundary", () => {
  const unset = run([], [], "unset");
  const empty = run([]);
  assert.equal(unset.inventory_state, "unset");
  assert.equal(empty.inventory_state, "empty");
  for (const result of [unset, empty]) {
    assert.equal(result.error, "");
    assert.equal(result.recommendations.length, 18);
    assert.ok(result.recommendations.every((item) => !item.can_make));
  }
  assert.deepEqual(find(unset, "mojito").missing, []);
  assert.equal(find(empty, "mojito").missing.length, 6);
});

test("M2 real Mojito requires sugar and ice as well as mint, lime, rum and soda", () => {
  const incomplete = find(run(["white-rum", "lime", "mint", "soda"]), "mojito");
  assert.equal(incomplete.can_make, false);
  assert.deepEqual(
    incomplete.missing.map((item) => item.id),
    ["white-sugar", "ice"],
  );
  assert.equal(
    find(
      run(["white-rum", "lime", "mint", "soda", "white-sugar", "ice"]),
      "mojito",
    ).can_make,
    true,
  );
});

test("M2 makeability always comes before all mood preference scores", () => {
  const response = run(
    ["gin", "tonic", "ice"],
    ["sweet", "fruity", "tropical"],
  );
  assert.equal(response.recommendations[0].recipe_id, "gin-tonic");
  assert.equal(response.recommendations[0].can_make, true);
  assert.equal(find(response, "tequila-sunrise").score, 30);
});

test("M2 aliases resolve in compiled MoonBit and unknown entries are not invented as stock", () => {
  const result = run([" GIN ", "金酒", "汤力水", "冰块", "火星原料"]);
  assert.deepEqual(result.canonical_inventory, ["gin", "tonic", "ice"]);
  assert.deepEqual(result.unknown_inventory, ["火星原料"]);
  assert.equal(find(result, "gin-tonic").can_make, true);
  const lime = run(["lime", " 青柠 ", "青柠汁", "fresh lime juice"]);
  assert.deepEqual(lime.canonical_inventory, ["lime"]);
  const unknownOnly = run(["未知原料"]);
  assert.equal(unknownOnly.inventory_state, "recorded");
  assert.deepEqual(unknownOnly.canonical_inventory, []);
  assert.ok(unknownOnly.recommendations.every((item) => !item.can_make));
});

test("M2 materially different ingredients are never aliases", () => {
  assert.equal(find(run(["gin", "soda", "ice"]), "gin-tonic").can_make, false);
  assert.equal(
    find(run(["gin", "sweet-vermouth", "ice"]), "dry-martini").can_make,
    false,
  );
  assert.equal(
    find(run(["cognac", "sweet-vermouth", "angostura", "ice"]), "manhattan")
      .can_make,
    false,
  );
  assert.equal(
    find(run(["white-rum", "lime", "sugar-syrup", "ice"]), "daiquiri").can_make,
    false,
  );
});

test("M2 a source-permitted rye alternative works for Boulevardier but not arbitrary whiskey", () => {
  assert.equal(
    find(run(["rye", "campari", "sweet-vermouth", "ice"]), "boulevardier")
      .can_make,
    true,
  );
  assert.equal(
    find(run(["cognac", "campari", "sweet-vermouth", "ice"]), "boulevardier")
      .can_make,
    false,
  );
});

test("M2 optional Margarita salt does not change required completeness", () => {
  const result = find(
    run(["tequila", "triple-sec", "lime", "ice"]),
    "margarita",
  );
  assert.equal(result.can_make, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(
    result.missing_optional.map((item) => item.id),
    ["salt"],
  );
});

test("M2 every verified recipe becomes makeable with its actual required inventory", () => {
  for (const recipe of recipes) {
    const result = find(
      run(
        recipe.ingredients
          .filter((item) => !item.optional)
          .map((item) => item.id),
      ),
      recipe.id,
    );
    assert.equal(result.can_make, true, recipe.id);
    assert.deepEqual(result.missing, [], recipe.id);
  }
});

test("M2 every removed required material is reported, even if it is ice or water", () => {
  for (const recipe of recipes) {
    const required = recipe.ingredients.filter((item) => !item.optional);
    for (const removed of required) {
      const owned = required
        .filter((item) => item.id !== removed.id)
        .map((item) => item.id);
      const result = find(run(owned), recipe.id);
      assert.equal(result.can_make, false, `${recipe.id}/${removed.id}`);
      assert.deepEqual(
        result.missing.map((item) => item.id),
        [removed.id],
      );
    }
  }
});

test("M2 malformed and contradictory requests return errors and no fabricated results", () => {
  for (const inventory of [
    "{}",
    '{"status":"unset","owned":["gin"]}',
    '{"status":"set","owned":[1]}',
  ]) {
    const result = JSON.parse(
      recommend_inventory_json(
        JSON.stringify(recipes),
        inventory,
        "[]",
        JSON.stringify(materials),
      ),
    );
    assert.ok(result.error);
    assert.deepEqual(result.recommendations, []);
  }
});

test("M2 invalid catalogs are rejected, including ambiguity, empty recipes and unknown materials", () => {
  const ambiguous = [
    ...materials,
    { id: "other", name: "Other", name_en: "Other", aliases: ["lime"] },
  ];
  const cases = [
    run([], [], "set", recipes, ambiguous),
    run([], [], "set", [...recipes, recipes[0]]),
    run([], [], "set", [{ ...recipes[0], ingredients: [] }]),
    run([], [], "set", [
      {
        ...recipes[0],
        ingredients: [
          { id: "fiction", name: "bad", optional: false, alternatives: [] },
        ],
      },
    ]),
  ];
  for (const result of cases) {
    assert.ok(result.error);
    assert.deepEqual(result.recommendations, []);
  }
});
