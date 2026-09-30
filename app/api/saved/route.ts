import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getMeal } from '@/lib/mealdb';

async function authorized(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!url || !key || !token) return null;
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : { client, user: data.user };
}
export async function GET(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite, kad matytumėte išsaugotus receptus.' }, { status: 401 });
  const { data, error } = await auth.client.from('saved_recipes').select('meal_id,meal_name,meal_thumb,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false });
  return error ? NextResponse.json({ error: 'Nepavyko gauti išsaugotų receptų.' }, { status: 502 }) : NextResponse.json({ meals: data });
}
export async function POST(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite, kad išsaugotumėte receptą.' }, { status: 401 });
  let body: { mealId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Neteisinga užklausa.' }, { status: 400 }); }
  if (typeof body.mealId !== 'string' || !/^\d+$/.test(body.mealId)) return NextResponse.json({ error: 'Neteisingas recepto ID.' }, { status: 400 });
  try {
    const meal = await getMeal(body.mealId);
    if (!meal) return NextResponse.json({ error: 'Receptas nerastas.' }, { status: 404 });
    const { error } = await auth.client.from('saved_recipes').upsert({ user_id: auth.user.id, meal_id: meal.idMeal, meal_name: meal.strMeal, meal_thumb: meal.strMealThumb }, { onConflict: 'user_id,meal_id' });
    return error ? NextResponse.json({ error: 'Nepavyko išsaugoti recepto.' }, { status: 502 }) : NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Nepavyko išsaugoti recepto.' }, { status: 502 }); }
}
export async function DELETE(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite.' }, { status: 401 });
  const mealId = new URL(request.url).searchParams.get('mealId');
  if (!mealId || !/^\d+$/.test(mealId)) return NextResponse.json({ error: 'Neteisingas recepto ID.' }, { status: 400 });
  const { data, error } = await auth.client.from('saved_recipes').delete().eq('user_id', auth.user.id).eq('meal_id', mealId).select('meal_id');
  if (error) return NextResponse.json({ error: 'Nepavyko pašalinti recepto.' }, { status: 502 });
  if (!data?.length) return NextResponse.json({ error: 'Receptas nerastas tarp jūsų išsaugotų receptų.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
