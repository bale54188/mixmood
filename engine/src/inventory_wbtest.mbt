///|
fn stock_materials() -> Array[Material] {
  [
    Material::{
      id: "lime",
      name: "青柠",
      name_en: "Lime",
      aliases: ["lime juice", "青柠汁"],
    },
    Material::{
      id: "gin",
      name: "金酒",
      name_en: "Gin",
      aliases: ["琴酒"],
    },
    Material::{
      id: "tonic",
      name: "汤力水",
      name_en: "Tonic water",
      aliases: ["tonic"],
    },
    Material::{
      id: "soda",
      name: "苏打水",
      name_en: "Soda water",
      aliases: ["soda"],
    },
  ]
}

///|
fn stock_recipe(
  id : String,
  tags : Array[String],
  ids : Array[String],
) -> StockRecipe {
  StockRecipe::{
    id,
    tags,
    ingredients: ids.map(fn(id) {
      RequiredMaterial::{ id, name: id, optional: false, alternatives: [], }
    }),
  }
}

///|
test "M2 unset inventory cannot claim makeability or known missing stock" {
  let response = rank_inventory(
    [stock_recipe("a", [], ["gin"])],
    InventoryInput::{ status: "unset", owned: [], },
    [],
    stock_materials(),
  )
  assert_eq(response.inventory_state, "unset")
  assert_false(response.recommendations[0].can_make)
  assert_eq(response.recommendations[0].missing.length(), 0)
}

///|
test "M2 explicitly empty inventory returns every required ingredient" {
  let response = rank_inventory(
    [stock_recipe("a", [], ["gin", "tonic"])],
    InventoryInput::{ status: "set", owned: [], },
    [],
    stock_materials(),
  )
  assert_eq(response.inventory_state, "empty")
  assert_false(response.recommendations[0].can_make)
  assert_eq(response.recommendations[0].missing.length(), 2)
}

///|
test "M2 complete inventory means makeable" {
  let response = rank_inventory(
    [stock_recipe("a", [], ["gin", "tonic"])],
    InventoryInput::{ status: "set", owned: ["gin", "tonic"], },
    [],
    stock_materials(),
  )
  assert_true(response.recommendations[0].can_make)
  assert_eq(response.inventory_state, "recorded")
}

///|
test "M2 exact missing ingredients are returned" {
  let response = rank_inventory(
    [stock_recipe("a", [], ["gin", "tonic"])],
    InventoryInput::{ status: "set", owned: ["gin"], },
    [],
    stock_materials(),
  )
  assert_eq(response.recommendations[0].missing[0].id, "tonic")
}

///|
test "M2 complete recipe always outranks incomplete taste matches" {
  let response = rank_inventory(
    [
      stock_recipe("complete", [], ["gin"]),
      stock_recipe("incomplete", ["a", "b", "c", "d"], ["tonic"]),
    ],
    InventoryInput::{ status: "set", owned: ["gin"], },
    ["a", "b", "c", "d"],
    stock_materials(),
  )
  assert_eq(response.recommendations[0].recipe_id, "complete")
}

///|
test "M2 mood sorts within the same completeness group" {
  let response = rank_inventory(
    [
      stock_recipe("a", ["fresh"], ["gin"]),
      stock_recipe("b", ["bitter"], ["gin"]),
    ],
    InventoryInput::{ status: "set", owned: ["gin"], },
    ["bitter"],
    stock_materials(),
  )
  assert_eq(response.recommendations[0].recipe_id, "b")
}

///|
test "M2 Chinese aliases and English whitespace normalize in MoonBit" {
  let response = rank_inventory(
    [stock_recipe("a", [], ["lime", "gin"])],
    InventoryInput::{
      status: "set",
      owned: [" 青柠 ", " GIN ", "lime juice", "青柠汁"],
    },
    [],
    stock_materials(),
  )
  assert_true(response.recommendations[0].can_make)
  assert_eq(response.canonical_inventory.length(), 2)
}

///|
test "M2 tonic cannot be substituted with soda" {
  let response = rank_inventory(
    [stock_recipe("a", [], ["gin", "tonic"])],
    InventoryInput::{ status: "set", owned: ["gin", "soda"], },
    [],
    stock_materials(),
  )
  assert_false(response.recommendations[0].can_make)
  assert_eq(response.recommendations[0].missing[0].id, "tonic")
}

///|
test "M2 unknown aliases are reported and never treated as owned" {
  let response = rank_inventory(
    [stock_recipe("a", [], ["gin"])],
    InventoryInput::{ status: "set", owned: ["mystery"], },
    [],
    stock_materials(),
  )
  assert_eq(response.canonical_inventory.length(), 0)
  assert_eq(response.unknown_inventory, ["mystery"])
  assert_false(response.recommendations[0].can_make)
}

///|
test "M2 optional material cannot prevent makeability" {
  let recipe = StockRecipe::{
    id: "a",
    tags: [],
    ingredients: [
      RequiredMaterial::{
        id: "gin",
        name: "金酒",
        optional: false,
        alternatives: [],
      },
      RequiredMaterial::{
        id: "lime",
        name: "青柠",
        optional: true,
        alternatives: [],
      },
    ],
  }
  let response = rank_inventory(
    [recipe],
    InventoryInput::{ status: "set", owned: ["gin"], },
    [],
    stock_materials(),
  )
  assert_true(response.recommendations[0].can_make)
  assert_eq(response.recommendations[0].missing_optional[0].id, "lime")
}

///|
test "M2 only explicit recipe alternatives can substitute" {
  let recipe = StockRecipe::{
    id: "a",
    tags: [],
    ingredients: [
      RequiredMaterial::{
        id: "gin",
        name: "test alternative",
        optional: false,
        alternatives: ["tonic"],
      },
    ],
  }
  let response = rank_inventory(
    [recipe],
    InventoryInput::{ status: "set", owned: ["tonic"], },
    [],
    stock_materials(),
  )
  assert_true(response.recommendations[0].can_make)
}

///|
test "M2 duplicate preference tags count only once" {
  let response = rank_inventory(
    [stock_recipe("a", ["fresh", "fresh"], ["gin"])],
    InventoryInput::{ status: "unset", owned: [], },
    ["FRESH", "fresh"],
    stock_materials(),
  )
  assert_eq(response.recommendations[0].score, 10)
}

///|
test "M2 fewer missing materials break an equal taste score tie" {
  let response = rank_inventory(
    [stock_recipe("a", [], ["gin", "tonic"]), stock_recipe("b", [], ["gin"])],
    InventoryInput::{ status: "set", owned: [], },
    [],
    stock_materials(),
  )
  assert_eq(response.recommendations[0].recipe_id, "b")
}

///|
test "M2 invalid inventory state is rejected by exported API" {
  let response = recommend_inventory_json(
    "[]", "{\"status\":\"bad\",\"owned\":[]}", "[]", "[]",
  )
  assert_true(response.contains("Inventory status must be unset or set"))
}

///|
test "M2 contradictory unset inventory is rejected" {
  let response = recommend_inventory_json(
    "[]", "{\"status\":\"unset\",\"owned\":[\"gin\"]}", "[]", "[]",
  )
  assert_true(
    response.contains("Unset inventory cannot contain owned materials"),
  )
}

///|
test "M2 malformed JSON returns a structured error" {
  let response = recommend_inventory_json("{", "{}", "[]", "[]")
  assert_true(response.contains("Invalid inventory recommendation input"))
}
