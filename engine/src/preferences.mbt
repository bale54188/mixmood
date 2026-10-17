///|
priv struct TastePreferences {
  flavors : Array[String]
  difficulty : String
  description : String
} derive(@json.FromJson)

///|
priv struct RecipeDifficulty {
  id : String
  difficulty : String
} derive(@json.FromJson)

///|
fn rank_preferences(
  recipes : Array[StockRecipe],
  difficulties : Array[RecipeDifficulty],
  inventory : InventoryInput,
  preferences : TastePreferences,
  materials : Array[Material],
) -> StockResponse raise {
  let preferred = match preferences.difficulty {
    "any" => ""
    "easy" => "简单"
    "intermediate" => "进阶"
    _ => raise InvalidInventory("Unsupported preference difficulty")
  }
  if preferences.description.length() > 160 {
    raise InvalidInventory("Preference description too long")
  }
  let known_tags : Array[String] = []
  for recipe in recipes {
    known_tags.append(recipe.tags)
  }
  for tag in preferences.flavors {
    if !known_tags.contains(tag) {
      raise InvalidInventory("Unsupported preference flavor")
    }
  }
  let difficulty_by_id : Map[String, String] = Map([])
  for recipe in difficulties {
    if recipe.difficulty != "简单" && recipe.difficulty != "进阶" {
      raise InvalidInventory("Unsupported recipe difficulty")
    }
    difficulty_by_id.set(recipe.id, recipe.difficulty)
  }
  let response = rank_inventory(
    recipes,
    inventory,
    preferences.flavors,
    materials,
  )
  response.recommendations.sort_by(fn(a, b) {
    let a_easy = preferred != "" &&
      difficulty_by_id.get(a.recipe_id) == Some(preferred)
    let b_easy = preferred != "" &&
      difficulty_by_id.get(b.recipe_id) == Some(preferred)
    if a.can_make != b.can_make {
      if a.can_make {
        -1
      } else {
        1
      }
    } else if a.score != b.score {
      b.score.compare(a.score)
    } else if a_easy != b_easy {
      if a_easy {
        -1
      } else {
        1
      }
    } else if a.missing.length() != b.missing.length() {
      a.missing.length().compare(b.missing.length())
    } else {
      a.recipe_id.compare(b.recipe_id)
    }
  })
  response
}

///|
/// AI supplies only validated preferences; existing MoonBit inventory rules stay authoritative.
#export_name("recommend_preferences_json")
pub fn recommend_preferences_json(
  recipes_json : String,
  inventory_json : String,
  preferences_json : String,
  materials_json : String,
) -> String {
  let response = try {
    let parsed = @json.parse(recipes_json)
    let recipes : Array[StockRecipe] = @json.from_json(parsed)
    let difficulties : Array[RecipeDifficulty] = @json.from_json(parsed)
    let inventory : InventoryInput = @json.from_json(
      @json.parse(inventory_json),
    )
    let preferences : TastePreferences = @json.from_json(
      @json.parse(preferences_json),
    )
    let materials : Array[Material] = @json.from_json(
      @json.parse(materials_json),
    )
    rank_preferences(recipes, difficulties, inventory, preferences, materials)
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
        error: "Invalid preference recommendation input",
        inventory_state: "unset",
        canonical_inventory: [],
        unknown_inventory: [],
        recommendations: [],
      }
  }
  @json.ToJson::to_json(response).stringify()
}
