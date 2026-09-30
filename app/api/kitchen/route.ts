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

const fields = 'id,name,created_at';

export async function GET(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite, kad matytumėte savo virtuvės produktus.' }, { status: 401 });
  const { data, error } = await auth.client.from('kitchen_items').select(fields).eq('user_id', auth.user.id).order('created_at');
  return error
    ? NextResponse.json({ error: 'Nepavyko gauti produktų. Patikrinkite, ar Supabase paleistas kitchen.sql.' }, { status: 502 })
    : NextResponse.json({ items: data });
}

export async function POST(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite, kad pridėtumėte produktą.' }, { status: 401 });
  let body: { name?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Neteisinga užklausa.' }, { status: 400 }); }
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 60) {
    return NextResponse.json({ error: 'Įveskite produkto pavadinimą (iki 60 simbolių).' }, { status: 400 });
  }
  const { data, error } = await auth.client.from('kitchen_items').insert({ user_id: auth.user.id, name: body.name.trim() }).select(fields).single();
  if (error?.code === '23505') return NextResponse.json({ error: 'Šis produktas jau yra jūsų virtuvėje.' }, { status: 409 });
  return error
    ? NextResponse.json({ error: 'Nepavyko pridėti produkto. Patikrinkite, ar Supabase paleistas kitchen.sql.' }, { status: 502 })
    : NextResponse.json({ item: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: 'Prisijunkite.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Neteisingas produkto ID.' }, { status: 400 });
  }
  const { data, error } = await auth.client.from('kitchen_items').delete().eq('user_id', auth.user.id).eq('id', id).select('id');
  if (error) return NextResponse.json({ error: 'Nepavyko pašalinti produkto.' }, { status: 502 });
  if (!data?.length) return NextResponse.json({ error: 'Produktas jūsų virtuvėje nerastas.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
