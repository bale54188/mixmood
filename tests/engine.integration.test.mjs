import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recommend_json } from "../web/src/generated/engine.mjs";

const recipes = JSON.parse(
  await readFile(
    new URL("../data/recipes.example.json", import.meta.url),
    "utf8",
  ),
);
const recommend = (owned, tags, catalog = recipes) =>
  JSON.parse(
    recommend_json(
      JSON.stringify(catalog),
      JSON.stringify(owned),
      JSON.stringify(tags),
    ),
  );

test("actual compiled ESM parses all three fixtures and returns exact inventory results", () => {
  const result = recommend(["rum", "lime", "soda"], ["fresh", "citrus"]);
  assert.equal(result.engine, "moonbit-js");
  assert.equal(result.error, "");
  assert.equal(result.recommendations.length, 3);
  assert.equal(result.recommendations[0].recipe.id, "mint-spark");
  assert.deepEqual(result.recommendations[0].missing, [
    { id: "mint", name: "薄荷" },
  ]);
  assert.equal(result.recommendations[0].can_make, false);
  assert.equal(result.recommendations[0].score, 18);
});

test("adding mint changes the compiled engine result to makeable", () => {
  const first = recommend(["rum", "lime", "soda", "mint"], ["fresh"])
    .recommendations[0];
  assert.equal(first.recipe.id, "mint-spark");
  assert.equal(first.can_make, true);
  assert.deepEqual(first.missing, []);
});

test("changing taste preferences changes the first recipe", () => {
  const first = recommend(["rum", "lime", "soda"], ["sweet", "fruity"])
    .recommendations[0];
  assert.equal(first.recipe.id, "sunset-punch");
  assert.deepEqual(first.matched_tags, ["sweet", "fruity"]);
});

test("runtime input is parsed by compiled MoonBit rather than a hardcoded catalog", () => {
  const custom = [
    {
      id: "runtime-only",
      name: "Custom",
      description: "",
      tags: ["custom"],
      ingredients: [{ id: "water", name: "Water" }],
    },
  ];
  const result = recommend([" WATER "], ["custom"], custom);
  assert.equal(result.recommendations[0].recipe.id, "runtime-only");
  assert.equal(result.recommendations[0].can_make, true);
});

test("invalid boundary input returns a structured error, never fabricated recipes", () => {
  for (const input of ["{", "{}", '[{"id": "missing-fields"}]']) {
    const response = JSON.parse(recommend_json(input, "[]", "[]"));
    assert.ok(response.error);
    assert.deepEqual(response.recommendations, []);
  }
});
