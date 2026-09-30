import { NextRequest, NextResponse } from 'next/server';
import { searchMeals, searchMealsByName } from '@/lib/mealdb';

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode') ?? 'ingredient';
  const query = (request.nextUrl.searchParams.get('query') ?? request.nextUrl.searchParams.get('ingredient') ?? '').trim();
  if (mode !== 'ingredient' && mode !== 'name') return NextResponse.json({ error: 'Neteisingas paieškos būdas.' }, { status: 400 });
  if (!query || query.length > 80) return NextResponse.json({ error: 'Įveskite paieškos tekstą (iki 80 simbolių).' }, { status: 400 });
  try { return NextResponse.json({ meals: mode === 'name' ? await searchMealsByName(query) : await searchMeals(query) }); }
  catch { return NextResponse.json({ error: 'Receptų paslauga šiuo metu nepasiekiama arba grąžino netinkamą atsakymą. Bandykite vėliau.' }, { status: 502 }); }
}
