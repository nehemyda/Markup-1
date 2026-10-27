/// <reference types="vite/client" />
// The browser's Supabase client: sign-in (Supabase Auth), data (Postgres with Row Level Security) and live updates
// (Realtime). Only the public anon/publishable key is used here; the service-role key stays on the server.
//
// The plain supabase-js client (not @supabase/ssr, which is for server-rendered apps and only accepts "?code=" links):
// password reset, email confirmation and dashboard-made links return with the session after "#", which this reads.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

if (!url || !key) {
  console.error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example).');
}

export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});

// The signed-in account's access token for calls to our server (null when signed out)
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}
