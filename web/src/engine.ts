import recipeData from "../../data/recipes.json";
import materialData from "../../data/ingredients.json";
import { recommend_inventory_json } from "./generated/engine.mjs";

export interface Material {
  id: string;
  name: string;
  name_en: string;
  aliases: string[];
}
export interface Ingredient {
  id: string;
  name: string;
  amount: number | null;
  unit: string;
  amount_note: string;
  optional: boolean;
  alternatives: string[];
}
export interface Recipe {
  id: string;
  name: string;
  name_en: string;
  description: string;
  tags: string[];
  ingredients: Ingredient[];
  difficulty: string;
  minutes: number;
  estimate_note: string;
  steps: string[];
  garnish: string;
  source: {
    publisher: string;
    url: string;
    checked_on: string;
    notes: string;
    supplement?: string;
  };
}
export interface Inventory {
  status: "unset" | "set";
  owned: string[];
}
export type InventoryState = "unset" | "empty" | "recorded";
export interface RankedRecipe {
  recipe_id: string;
  inventory_state: InventoryState;
  can_make: boolean;
  missing: Pick<Ingredient, "id" | "name" | "optional" | "alternatives">[];
  missing_optional: Pick<
    Ingredient,
    "id" | "name" | "optional" | "alternatives"
  >[];
  matched_tags: string[];
  score: number;
}
export interface Recommendation extends RankedRecipe {
  recipe: Recipe;
}
interface EngineResponse {
  engine: string;
  error: string;
  inventory_state: InventoryState;
  canonical_inventory: string[];
  unknown_inventory: string[];
  recommendations: RankedRecipe[];
}
export const ingredients: Material[] = materialData;
export const recipes: Recipe[] = recipeData;
const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

// Serializes and joins display metadata only; compiled MoonBit owns all matching and ranking.
export function getRecommendations(inventory: Inventory, tags: string[]) {
  const response = JSON.parse(
    recommend_inventory_json(
      JSON.stringify(recipes),
      JSON.stringify(inventory),
      JSON.stringify(tags),
      JSON.stringify(ingredients),
    ),
  ) as EngineResponse;
  if (response.error) throw new Error(response.error);
  if (response.engine !== "moonbit-js")
    throw new Error("Unexpected recommendation engine");
  return {
    ...response,
    recommendations: response.recommendations.map((item) => {
      const recipe = recipesById.get(item.recipe_id);
      if (!recipe) throw new Error("Unknown recipe from recommendation engine");
      return { ...item, recipe };
    }),
  };
}
