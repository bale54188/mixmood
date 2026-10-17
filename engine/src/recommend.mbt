///|
/// Ingredient IDs are canonical keys; names are display text, never matching keys.
priv struct Ingredient {
  id : String
  name : String
} derive(@json.FromJson, @json.ToJson)

///|
/// M1 fixtures deliberately contain no quantities or preparation instructions.
priv struct Recipe {
  id : String
  name : String
  description : String
  tags : Array[String]
  ingredients : Array[Ingredient]
} derive(@json.FromJson, @json.ToJson)

///|
priv struct Recommendation {
  recipe : Recipe
  can_make : Bool
  missing : Array[Ingredient]
  matched_tags : Array[String]
  score : Int32
} derive(@json.ToJson)

///|
priv struct Response {
  engine : String
  error : String
  recommendations : Array[Recommendation]
} derive(@json.ToJson)

///|
/// Keep boundary normalization in MoonBit, including duplicate input handling.
fn normalize(values : Array[String]) -> Array[String] {
  let result : Array[String] = []
  for value in values {
    let key = value.trim().to_owned().to_lower()
    if key != "" && !result.contains(key) {
      result.push(key)
    }
  }
  result
}

///|
fn missing_ingredients(
  recipe : Recipe,
  owned : Array[String],
) -> Array[Ingredient] {
  let inventory = normalize(owned)
  recipe.ingredients.filter(fn(ingredient) {
    !inventory.contains(ingredient.id)
  })
}

///|
/// Preferences lead; complete recipes and fewer missing ingredients break ties.
fn recommend(
  recipes : Array[Recipe],
  owned : Array[String],
  preferences : Array[String],
) -> Array[Recommendation] {
  let tags = normalize(preferences)
  let results = recipes.map(fn(recipe) {
    let missing = missing_ingredients(recipe, owned)
    let matched = normalize(recipe.tags).filter(fn(tag) { tags.contains(tag) })
    let can_make = missing.is_empty()
    let bonus = if can_make { 5 } else { 0 }
    let score = matched.length() * 10 - missing.length() * 2 + bonus
    Recommendation::{ recipe, can_make, missing, matched_tags: matched, score, }
  })
  results.sort_by(fn(a, b) {
    if a.score != b.score {
      b.score.compare(a.score)
    } else {
      a.recipe.id.compare(b.recipe.id)
    }
  })
  results
}

///|
/// JSON strings have a stable JS ABI; no MoonBit collection internals cross it.
#export_name("recommend_json")
pub fn recommend_json(
  recipes_json : String,
  owned_json : String,
  preferences_json : String,
) -> String {
  let response = try {
    let recipes : Array[Recipe] = @json.from_json(@json.parse(recipes_json))
    let owned : Array[String] = @json.from_json(@json.parse(owned_json))
    let preferences : Array[String] = @json.from_json(
      @json.parse(preferences_json),
    )
    Response::{
      engine: "moonbit-js",
      error: "",
      recommendations: recommend(recipes, owned, preferences),
    }
  } catch {
    _ =>
      Response::{
        engine: "moonbit-js",
        error: "Invalid recommendation input: expected recipe and string arrays.",
        recommendations: [],
      }
  }
  @json.ToJson::to_json(response).stringify()
}
