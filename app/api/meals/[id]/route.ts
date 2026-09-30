import { NextResponse } from 'next/server';
import { getMeal } from '@/lib/mealdb';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Neteisingas recepto ID.' }, { status: 400 });
  try {
    const meal = await getMeal(id);
    return meal ? NextResponse.json({ meal }) : NextResponse.json({ error: 'Receptas nerastas.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Receptų paslauga šiuo metu nepasiekiama arba grąžino netinkamą atsakymą. Bandykite vėliau.' }, { status: 502 }); }
}
