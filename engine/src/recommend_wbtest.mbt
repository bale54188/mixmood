///|
fn fixture(id : String, tags : Array[String], ids : Array[String]) -> Recipe {
  Recipe::{
    id,
    name: id,
    description: "Technical fixture only",
    tags,
    ingredients: ids.map(fn(id) { Ingredient::{ id, name: id, } }),
  }
}

///|
test "all required ingredients means makeable" {
  let recipe = fixture("mint", ["fresh"], ["mint", "soda"])
  let results = recommend([recipe], ["mint", "soda"], [])
  assert_true(results[0].can_make)
  assert_eq(results[0].missing.length(), 0)
}

///|
test "partial inventory returns exact missing ingredient" {
  let recipe = fixture("mint", [], ["mint", "soda"])
  let result = recommend([recipe], ["mint"], [])[0]
  assert_false(result.can_make)
  assert_eq(result.missing.length(), 1)
  assert_eq(result.missing[0].id, "soda")
}

///|
test "empty inventory misses every required ingredient" {
  let recipe = fixture("mint", [], ["mint", "soda"])
  assert_eq(missing_ingredients(recipe, []).length(), 2)
}

///|
test "unknown and duplicate inventory keys do not alter matching" {
  let recipe = fixture("mint", [], ["mint", "soda"])
  assert_eq(
    missing_ingredients(recipe, ["unknown", "mint", "mint"]).length(),
    1,
  )
}

///|
test "inventory keys normalize whitespace and ASCII casing" {
  let recipe = fixture("mint", [], ["mint", "soda"])
  assert_true(recommend([recipe], [" MINT ", "Soda"], [])[0].can_make)
}

///|
test "taste matches determine recommendation order" {
  let fresh = fixture("a", ["fresh"], ["soda"])
  let bitter = fixture("b", ["bitter"], ["soda"])
  let results = recommend([fresh, bitter], [], ["bitter"])
  assert_eq(results[0].recipe.id, "b")
  assert_eq(results[0].matched_tags, ["bitter"])
}

///|
test "complete inventory ranks ahead at equal taste match count" {
  let complete = fixture("a", ["fresh"], ["soda"])
  let incomplete = fixture("b", ["fresh"], ["soda", "mint"])
  assert_eq(
    recommend([incomplete, complete], ["soda"], ["fresh"])[0].recipe.id,
    "a",
  )
}

///|
test "duplicate preferences and recipe tags cannot inflate score" {
  let recipe = fixture("a", ["fresh", "fresh"], ["soda"])
  assert_eq(
    recommend([recipe], ["soda"], ["FRESH", "fresh", " fresh "])[0].score,
    15,
  )
}

///|
test "equal scores use recipe ID for deterministic order" {
  let a = fixture("a", [], ["soda"])
  let b = fixture("b", [], ["soda"])
  assert_eq(recommend([b, a], [], [])[0].recipe.id, "a")
}

///|
test "empty catalog returns no recommendations" {
  assert_eq(recommend([], ["soda"], ["fresh"]).length(), 0)
}

///|
test "exported JSON function rejects malformed JSON" {
  let response = recommend_json("{", "[]", "[]")
  assert_true(response.contains("Invalid recommendation input"))
}

///|
test "exported JSON function rejects wrong input types" {
  let response = recommend_json("[]", "[1]", "[]")
  assert_true(response.contains("Invalid recommendation input"))
}
