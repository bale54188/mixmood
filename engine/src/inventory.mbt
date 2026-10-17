///|
/// Full material catalog is passed as data, rather than encoded in TypeScript.
priv struct Material {
  id : String
  name : String
  name_en : String
  aliases : Array[String]
} derive(@json.FromJson)

///|
priv struct RequiredMaterial {
  id : String
  name : String
  optional : Bool
  alternatives : Array[String]
} derive(@json.FromJson, @json.ToJson)

///|
priv struct StockRecipe {
  id : String
  tags : Array[String]
  ingredients : Array[RequiredMaterial]
} derive(@json.FromJson)

///|
priv struct InventoryInput {
  status : String
  owned : Array[String]
} derive(@json.FromJson)

///|
priv struct StockRecommendation {
  recipe_id : String
  inventory_state : String
  can_make : Bool
  missing : Array[RequiredMaterial]
  missing_optional : Array[RequiredMaterial]
  matched_tags : Array[String]
  score : Int32
} derive(@json.ToJson)

///|
priv struct StockResponse {
  engine : String
  error : String
  inventory_state : String
  canonical_inventory : Array[String]
  unknown_inventory : Array[String]
  recommendations : Array[StockRecommendation]
} derive(@json.ToJson)

///|
priv suberror InventoryError {
  InvalidInventory(String)
}

///|
fn alias_index(materials : Array[Material]) -> Map[String, String] raise {
  let index : Map[String, String] = Map([])
  let ids : Array[String] = []
  for material in materials {
    if material.id == "" || ids.contains(material.id) {
      raise InvalidInventory("Invalid or duplicate material ID")
    }
    ids.push(material.id)
    let keys = [material.id, material.name, material.name_en]
    keys.append(material.aliases)
    for key in normalize(keys) {
      match index.get(key) {
        Some(existing) if existing != material.id =>
          raise InvalidInventory("Ambiguous material alias")
        _ => index.set(key, material.id)
      }
    }
  }
  index
}

///|
fn resolve_owned(
  raw : Array[String],
  index : Map[String, String],
) -> (Array[String], Array[String]) {
  let known : Array[String] = []
  let unknown : Array[String] = []
  for key in normalize(raw) {
    match index.get(key) {
      Some(id) => if !known.contains(id) { known.push(id) }
      None => unknown.push(key)
    }
  }
  (known, unknown)
}

///|
fn matches_material(material : RequiredMaterial, owned : Array[String]) -> Bool {
  owned.contains(material.id) ||
  material.alternatives.any(fn(id) { owned.contains(id) })
}

///|
fn rank_inventory(
  recipes : Array[StockRecipe],
  inventory : InventoryInput,
  tags : Array[String],
  materials : Array[Material],
) -> StockResponse raise {
  if inventory.status != "unset" && inventory.status != "set" {
    raise InvalidInventory("Inventory status must be unset or set")
  }
  if inventory.status == "unset" && !inventory.owned.is_empty() {
    raise InvalidInventory("Unset inventory cannot contain owned materials")
  }
  let index = alias_index(materials)
  let (owned, unknown) = resolve_owned(inventory.owned, index)
  let state = if inventory.status == "unset" {
    "unset"
  } else if inventory.owned.is_empty() {
    "empty"
  } else {
    "recorded"
  }
  let preferences = normalize(tags)
  let recipe_ids : Array[String] = []
  for recipe in recipes {
    if recipe.id == "" ||
      recipe_ids.contains(recipe.id) ||
      recipe.ingredients.is_empty() ||
      recipe.ingredients.all(fn(material) { material.optional }) {
      raise InvalidInventory(
        "Recipe must have a unique ID and required materials",
      )
    }
    recipe_ids.push(recipe.id)
    let ingredient_ids : Array[String] = []
    for material in recipe.ingredients {
      if ingredient_ids.contains(material.id) ||
        index.get(material.id) != Some(material.id) {
        raise InvalidInventory("Unknown or duplicate recipe material")
      }
      ingredient_ids.push(material.id)
      for alternative in material.alternatives {
        if index.get(alternative) != Some(alternative) {
          raise InvalidInventory("Unknown alternative material")
        }
      }
    }
  }
  let results = recipes.map(fn(recipe) {
    // Unset inventory is not an assertion that the user owns no materials.
    let missing = if state == "unset" {
      []
    } else {
      recipe.ingredients.filter(fn(material) {
        !material.optional && !matches_material(material, owned)
      })
    }
    let missing_optional = if state == "unset" {
      []
    } else {
      recipe.ingredients.filter(fn(material) {
        material.optional && !matches_material(material, owned)
      })
    }
    let matched = normalize(recipe.tags).filter(fn(tag) {
      preferences.contains(tag)
    })
    StockRecommendation::{
      recipe_id: recipe.id,
      inventory_state: state,
      can_make: state != "unset" && missing.is_empty(),
      missing,
      missing_optional,
      matched_tags: matched,
      score: matched.length() * 10,
    }
  })
  results.sort_by(fn(a, b) {
    // Completeness is a separate first sort key; any number of taste matches
    // can never outrank a fully makeable drink with a missing-ingredient one.
    if a.can_make != b.can_make {
      if a.can_make {
        -1
      } else {
        1
      }
    } else if a.score != b.score {
      b.score.compare(a.score)
    } else if a.missing.length() != b.missing.length() {
      a.missing.length().compare(b.missing.length())
    } else {
      a.recipe_id.compare(b.recipe_id)
    }
  })
  StockResponse::{
    engine: "moonbit-js",
    error: "",
    inventory_state: state,
    canonical_inventory: owned,
    unknown_inventory: unknown,
    recommendations: results,
  }
}

///|
/// M2 API. M1's recommend_json remains unchanged for regression compatibility.
#export_name("recommend_inventory_json")
pub fn recommend_inventory_json(
  recipes_json : String,
  inventory_json : String,
  tags_json : String,
  materials_json : String,
) -> String {
  let response = try {
    let recipes : Array[StockRecipe] = @json.from_json(
      @json.parse(recipes_json),
    )
    let inventory : InventoryInput = @json.from_json(
      @json.parse(inventory_json),
    )
    let tags : Array[String] = @json.from_json(@json.parse(tags_json))
    let materials : Array[Material] = @json.from_json(
      @json.parse(materials_json),
    )
    rank_inventory(recipes, inventory, tags, materials)
  } catch {
    InvalidInventory(message) =>
      StockResponse::{
        engine: "moonbit-js",
        error: message,
        inventory_state: "unset",
        canonical_inventory: [],
        unknown_inventory: [],
        recommendations: [],
      }
    _ =>
      StockResponse::{
        engine: "moonbit-js",
        error: "Invalid inventory recommendation input",
        inventory_state: "unset",
        canonical_inventory: [],
        unknown_inventory: [],
        recommendations: [],
      }
  }
  @json.ToJson::to_json(response).stringify()
}
