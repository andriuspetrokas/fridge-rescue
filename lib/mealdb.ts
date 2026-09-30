import type { Meal, MealSummary } from './types';

const base = process.env.MEALDB_API_BASE_URL || 'https://www.themealdb.com/api/json/v1/1';
async function getJson(path: string): Promise<{ meals: Record<string, string | null>[] | null }> {
  const response = await fetch(`${base}/${path}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('TheMealDB šiuo metu nepasiekiamas.');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('meals' in data) ||
      (data.meals !== null && (!Array.isArray(data.meals) || !data.meals.every((meal: unknown) => meal && typeof meal === 'object')))) {
    throw new Error('TheMealDB grąžino netinkamus duomenis.');
  }
  return data as { meals: Record<string, string | null>[] | null };
}
export async function searchMeals(ingredient: string): Promise<MealSummary[]> {
  const data = await getJson(`filter.php?i=${encodeURIComponent(ingredient)}`);
  return (data.meals ?? []).map((m) => ({ idMeal: m.idMeal ?? '', strMeal: m.strMeal ?? '', strMealThumb: m.strMealThumb ?? '' }));
}
export async function searchMealsByName(name: string): Promise<MealSummary[]> {
  const data = await getJson(`search.php?s=${encodeURIComponent(name)}`);
  return (data.meals ?? []).map((m) => ({ idMeal: m.idMeal ?? '', strMeal: m.strMeal ?? '', strMealThumb: m.strMealThumb ?? '' }));
}
export async function getMeal(id: string): Promise<Meal | null> {
  const data = await getJson(`lookup.php?i=${encodeURIComponent(id)}`);
  const m = data.meals?.[0];
  if (!m) return null;
  const ingredients = Array.from({ length: 20 }, (_, i) => ({ name: m[`strIngredient${i + 1}`]?.trim() ?? '', measure: m[`strMeasure${i + 1}`]?.trim() ?? '' })).filter((item) => item.name);
  return { idMeal: m.idMeal ?? '', strMeal: m.strMeal ?? '', strMealThumb: m.strMealThumb ?? '', strInstructions: m.strInstructions ?? '', strCategory: m.strCategory ?? null, strArea: m.strArea ?? null, strYoutube: m.strYoutube ?? null, ingredients };
}
