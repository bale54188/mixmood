///|
fn preference_recipes() -> Array[StockRecipe] {
  [
    stock_recipe("a", ["bitter"], ["gin"]),
    stock_recipe("b", ["bitter"], ["gin", "tonic"]),
  ]
}

///|
fn preference_difficulties() -> Array[RecipeDifficulty] {
  [
    RecipeDifficulty::{ id: "a", difficulty: "进阶", },
    RecipeDifficulty::{ id: "b", difficulty: "简单", },
  ]
}

///|
test "M3 easy preference breaks equal flavor scores inside MoonBit" {
  let result = rank_preferences(
    preference_recipes(),
    preference_difficulties(),
    InventoryInput::{ status: "unset", owned: [], },
    TastePreferences::{
      flavors: ["bitter"],
      difficulty: "easy",
      description: "微苦简单",
    },
    stock_materials(),
  )
  assert_eq(result.recommendations[0].recipe_id, "b")
  assert_false(result.recommendations[0].can_make)
}

///|
test "M3 intermediate preference is supported" {
  let result = rank_preferences(
    preference_recipes(),
    preference_difficulties(),
    InventoryInput::{ status: "unset", owned: [], },
    TastePreferences::{
      flavors: ["bitter"],
      difficulty: "intermediate",
      description: "微苦进阶",
    },
    stock_materials(),
  )
  assert_eq(result.recommendations[0].recipe_id, "a")
}

///|
test "M3 completeness outranks AI difficulty" {
  let result = rank_preferences(
    preference_recipes(),
    preference_difficulties(),
    InventoryInput::{ status: "set", owned: ["gin"], },
    TastePreferences::{
      flavors: ["bitter"],
      difficulty: "easy",
      description: "微苦简单",
    },
    stock_materials(),
  )
  assert_eq(result.recommendations[0].recipe_id, "a")
  assert_true(result.recommendations[0].can_make)
}

///|
test "M3 explicit empty inventory is never makeable" {
  let result = rank_preferences(
    preference_recipes(),
    preference_difficulties(),
    InventoryInput::{ status: "set", owned: [], },
    TastePreferences::{
      flavors: ["bitter"],
      difficulty: "any",
      description: "微苦",
    },
    stock_materials(),
  )
  assert_eq(result.inventory_state, "empty")
  assert_true(result.recommendations.all(fn(item) { !item.can_make }))
}

///|
test "M3 unknown flavors are rejected" {
  let message = try {
    let _ = rank_preferences(
      preference_recipes(),
      preference_difficulties(),
      InventoryInput::{ status: "unset", owned: [], },
      TastePreferences::{
        flavors: ["invented"],
        difficulty: "any",
        description: "test",
      },
      stock_materials(),
    )
    "no error"
  } catch {
    InvalidInventory(message) => message
    _ => "unexpected error"
  }
  assert_eq(message, "Unsupported preference flavor")
}

///|
test "M3 malformed preference JSON is rejected" {
  assert_true(
    recommend_preferences_json("[]", "{}", "{", "[]").contains(
      "Invalid preference recommendation input",
    ),
  )
}
