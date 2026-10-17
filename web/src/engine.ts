import recipes from "../../data/recipes.example.json";
import { recommend_json } from "./generated/engine.mjs";

export interface Ingredient {
  id: string;
  name: string;
}
export interface Recipe {
  id: string;
  name: string;
  description: string;
  tags: string[];
  ingredients: Ingredient[];
}
export interface Recommendation {
  recipe: Recipe;
  can_make: boolean;
  missing: Ingredient[];
  matched_tags: string[];
  score: number;
}
interface EngineResponse {
  engine: string;
  error: string;
  recommendations: Recommendation[];
}

// UI catalog only. All matching, missing-ingredient calculation and ranking live in MoonBit.
export const ingredients: Ingredient[] = Array.from(
  new Map(
    recipes
      .flatMap((recipe) => recipe.ingredients)
      .map((item) => [item.id, item]),
  ).values(),
);

export function getRecommendations(
  owned: string[],
  tags: string[],
): Recommendation[] {
  const response = JSON.parse(
    recommend_json(
      JSON.stringify(recipes),
      JSON.stringify(owned),
      JSON.stringify(tags),
    ),
  ) as EngineResponse;
  if (response.error) throw new Error(response.error);
  if (response.engine !== "moonbit-js")
    throw new Error("Unexpected recommendation engine");
  return response.recommendations;
}
