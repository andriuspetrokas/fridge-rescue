import { ApiError, GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { searchMeals, searchMealsByName } from '@/lib/mealdb';

async function translateSearchQuery(query: string, mode: 'ingredient' | 'name') {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_KEY_MISSING');

  const ai = new GoogleGenAI({ apiKey: key });
  const subject = mode === 'ingredient' ? 'ingredientą' : 'patiekalo pavadinimą';
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    contents: `Išversk pateiktą ${subject} į anglų kalbą, kad jį būtų galima naudoti TheMealDB paieškoje. Jei tekstas jau angliškas, palik jį angliškai. Grąžink tik vieną trumpą anglišką paieškos frazę be kabučių, paaiškinimų ir skyrybos ženklo pabaigoje. Vartotojo tekstas: ${JSON.stringify(query)}`,
  });
  const translated = response.text?.trim().replace(/^['"]|['"]$/g, '');
  if (!translated || translated.length > 80 || /[\r\n]/.test(translated)) throw new Error('INVALID_TRANSLATION');
  return translated;
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode') ?? 'ingredient';
  const query = (request.nextUrl.searchParams.get('query') ?? request.nextUrl.searchParams.get('ingredient') ?? '').trim();
  if (mode !== 'ingredient' && mode !== 'name') return NextResponse.json({ error: 'Neteisingas paieškos būdas.' }, { status: 400 });
  if (!query || query.length > 80) return NextResponse.json({ error: 'Įveskite paieškos tekstą (iki 80 simbolių).' }, { status: 400 });
  try {
    const searchMode = mode as 'ingredient' | 'name';
    const translatedQuery = await translateSearchQuery(query, searchMode);
    const meals = searchMode === 'name' ? await searchMealsByName(translatedQuery) : await searchMeals(translatedQuery);
    return NextResponse.json({ meals, translatedQuery });
  } catch (error) {
    if (error instanceof Error && error.message === 'GEMINI_KEY_MISSING') return NextResponse.json({ error: 'Lietuviškai paieškai trūksta Gemini API rakto.' }, { status: 503 });
    if (error instanceof ApiError && error.status === 429) return NextResponse.json({ error: 'Pasiektas Gemini užklausų limitas (429). Lietuviška paieška laikinai negalima – bandykite vėliau.' }, { status: 429 });
    if (error instanceof ApiError && error.status === 503) return NextResponse.json({ error: 'Gemini vertimo paslauga šiuo metu užimta. Bandykite dar kartą vėliau.' }, { status: 503 });
    if (error instanceof ApiError && [400, 401, 403].includes(error.status)) return NextResponse.json({ error: 'Gemini atmetė vertimo užklausą. Patikrinkite GEMINI_API_KEY ir API prieigą.' }, { status: 502 });
    if (error instanceof ApiError && error.status === 404) return NextResponse.json({ error: 'Gemini modelis nerastas. Patikrinkite GEMINI_MODEL reikšmę.' }, { status: 502 });
    return NextResponse.json({ error: 'Nepavyko išversti paieškos arba gauti receptų. Bandykite vėliau.' }, { status: 502 });
  }
}
