import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

async function authorized(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!url || !key || !token) return null;
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : { client, user: data.user };
}

const fields = 'id,meal_id,original_meal_name,user_request,ai_result,created_at';
const goals: Record<string, string> = {
  simpler: 'paprasčiau', cheaper: 'pigiau', healthier: 'sveikiau', similar: 'kuo panašiau į originalą',
};

export async function GET(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite, kad matytumėte AI receptus.' }, { status: 401 });
  const { data, error } = await auth.client.from('saved_ai_recipes').select(fields).eq('user_id', auth.user.id).order('created_at', { ascending: false });
  return error ? NextResponse.json({ error: 'Nepavyko gauti AI receptų. Patikrinkite, ar paleistas ai_recipes.sql.' }, { status: 502 }) : NextResponse.json({ recipes: data });
}

export async function POST(request: Request) {
  const auth = await authorized(request);
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
