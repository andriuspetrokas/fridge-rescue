import 'server-only';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export type AuthorizedSupabase = { client: SupabaseClient; user: User };

export async function authorizedSupabase(request: Request): Promise<AuthorizedSupabase | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!url || !key || !token) return null;

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : { client, user: data.user };
}
