import { NextResponse } from 'next/server';
import { authorizedSupabase } from '@/lib/supabase-server';

const fields = 'id,meal_id,original_meal_name,user_request,ai_result,created_at';
const goals: Record<string, string> = {
  simpler: 'paprasčiau', cheaper: 'pigiau', healthier: 'sveikiau', similar: 'kuo panašiau į originalą',
};

export async function GET(request: Request) {
  const auth = await authorizedSupabase(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite, kad matytumėte AI receptus.' }, { status: 401 });
  const { data, error } = await auth.client.from('saved_ai_recipes').select(fields).eq('user_id', auth.user.id).order('created_at', { ascending: false });
  return error ? NextResponse.json({ error: 'Nepavyko gauti AI receptų. Patikrinkite, ar paleistas ai_recipes.sql.' }, { status: 502 }) : NextResponse.json({ recipes: data });
}

export async function POST(request: Request) {
  const auth = await authorizedSupabase(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite, kad išsaugotumėte AI receptą.' }, { status: 401 });
  let body: { mealId?: unknown; mealName?: unknown; situation?: unknown; minutes?: unknown; people?: unknown; goal?: unknown; aiResult?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Neteisinga užklausa.' }, { status: 400 }); }
  if (typeof body.mealId !== 'string' || !/^\d+$/.test(body.mealId)
    || typeof body.mealName !== 'string' || !body.mealName.trim() || body.mealName.length > 200
    || typeof body.situation !== 'string' || !body.situation.trim() || body.situation.length > 500
    || typeof body.minutes !== 'number' || ![15, 30, 60].includes(body.minutes)
    || typeof body.people !== 'number' || ![1, 2, 4].includes(body.people)
    || typeof body.goal !== 'string' || !Object.hasOwn(goals, body.goal)
    || typeof body.aiResult !== 'string' || !body.aiResult.trim() || body.aiResult.length > 20000) {
    return NextResponse.json({ error: 'Trūksta recepto, prašymo arba AI atsakymo duomenų.' }, { status: 400 });
  }
  const userRequest = `Situacija: ${body.situation.trim()}\nLaikas: ${body.minutes} min.\nŽmonių skaičius: ${body.people}\nTikslas: ${goals[body.goal]}`;
  const { data, error } = await auth.client.from('saved_ai_recipes').insert({
    user_id: auth.user.id,
    meal_id: body.mealId,
    original_meal_name: body.mealName.trim(),
    user_request: userRequest,
    ai_result: body.aiResult.trim(),
  }).select(fields).single();
  return error ? NextResponse.json({ error: 'Nepavyko išsaugoti AI recepto. Patikrinkite, ar paleistas ai_recipes.sql.' }, { status: 502 }) : NextResponse.json({ recipe: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await authorizedSupabase(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite, kad pašalintumėte AI receptą.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Neteisingas AI recepto ID.' }, { status: 400 });
  }
  const { data, error } = await auth.client.from('saved_ai_recipes').delete().eq('user_id', auth.user.id).eq('id', id).select('id');
  if (error) return NextResponse.json({ error: 'Nepavyko pašalinti AI recepto.' }, { status: 502 });
  if (!data?.length) return NextResponse.json({ error: 'AI receptas nerastas tarp jūsų įrašų.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
