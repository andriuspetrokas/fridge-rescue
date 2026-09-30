export type MealSummary = { idMeal: string; strMeal: string; strMealThumb: string };
export type Meal = MealSummary & { strInstructions: string; strCategory: string | null; strArea: string | null; strYoutube: string | null; ingredients: { name: string; measure: string }[] };
export type SavedMeal = { meal_id: string; meal_name: string; meal_thumb: string; created_at: string };
export type SavedAiRecipe = { id: string; meal_id: string; original_meal_name: string; user_request: string; ai_result: string; created_at: string };
