import { ApiError, GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { getMeal } from '@/lib/mealdb';

const goalLabels = {
  simpler: 'paprasčiau',
  cheaper: 'pigiau',
  healthier: 'sveikiau',
  similar: 'kuo panašiau į originalą',
} as const;

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'Gemini API raktas dar nenustatytas.' }, { status: 503 });
  let body: { mealId?: unknown; situation?: unknown; minutes?: unknown; people?: unknown; goal?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Neteisinga užklausa.' }, { status: 400 }); }
  if (typeof body.mealId !== 'string' || !/^\d+$/.test(body.mealId) || typeof body.situation !== 'string' || !body.situation.trim() || body.situation.length > 500) {
    return NextResponse.json({ error: 'Pasirinkite receptą ir trumpai aprašykite savo situaciją.' }, { status: 400 });
  }
  if (typeof body.minutes !== 'number' || ![15, 30, 60].includes(body.minutes) || typeof body.people !== 'number' || ![1, 2, 4].includes(body.people) || typeof body.goal !== 'string' || !Object.hasOwn(goalLabels, body.goal)) {
    return NextResponse.json({ error: 'Pasirinkite laiką, žmonių skaičių ir pageidaujamą kryptį.' }, { status: 400 });
  }
  try {
    const meal = await getMeal(body.mealId);
    if (!meal) return NextResponse.json({ error: 'Receptas nerastas.' }, { status: 404 });
    // Explicit key wins over GOOGLE_API_KEY inherited from the terminal.
    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = `Esi praktiškas receptų pagalbininkas. Atsakyk lietuviškai ir pritaikyk originalų receptą pagal VISAS žemiau pateiktas vartotojo sąlygas.

Vartotojo sąlygos:
- Turimas laikas: ${body.minutes} min.
- Žmonių skaičius: ${body.people}.
- Pageidaujama kryptis: ${goalLabels[body.goal as keyof typeof goalLabels]}.
- Papildomas prašymas: ${body.situation.trim()}

Originalus receptas: ${meal.strMeal}
Originalūs ingredientai: ${meal.ingredients.map((i) => `${i.measure} ${i.name}`).join(', ')}
Originali gaminimo instrukcija: ${meal.strInstructions}

Pateik tris aiškias dalis: „Pritaikyti ingredientai“, „Gaminimo žingsniai“ ir „Kas pakeista“. Ingredientų kiekius pritaikyk žmonių skaičiui, jei iš originalo galima nustatyti porcijas; kitu atveju nurodyk apytikslius kiekius. Gerbk turimo laiko ribą; jei net supaprastinus receptas užtruktų ilgiau, aiškiai tai pasakyk. Jei prašymas susijęs su alergijomis, perspėk patikrinti produktų etiketes.`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
          contents: prompt,
        });
        if (!response.text?.trim()) throw new Error('Gemini grąžino tuščią atsakymą.');
        return NextResponse.json({ adaptation: response.text.trim() });
      } catch (error) {
        if (error instanceof ApiError && error.status === 503 && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** (attempt - 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Gemini neatsakė.');
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return NextResponse.json({ error: 'Pasiektas Gemini užklausų limitas (429). Palaukite ir bandykite vėliau; limitus galite patikrinti Google AI Studio.' }, { status: 429 });
    if (error instanceof ApiError && error.status === 503) return NextResponse.json({ error: 'Gemini šiuo metu užimtas. Bandykite vėliau.' }, { status: 503 });
    if (error instanceof ApiError && [400, 401, 403].includes(error.status)) return NextResponse.json({ error: 'Gemini atmetė užklausą. Patikrinkite GEMINI_API_KEY ir API prieigą Google AI Studio.' }, { status: 502 });
    if (error instanceof ApiError && error.status === 404) return NextResponse.json({ error: 'Gemini modelis nerastas. Patikrinkite GEMINI_MODEL reikšmę.' }, { status: 502 });
    if (error instanceof ApiError) console.error('Gemini API klaida:', error.status);
    else console.error('Recepto pritaikymo klaida:', error instanceof Error ? error.name : 'nežinoma');
    return NextResponse.json({ error: 'Nepavyko pritaikyti recepto. Bandykite dar kartą.' }, { status: 502 });
  }
}
