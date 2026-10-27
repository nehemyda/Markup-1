import { accessToken } from './supabase';

// Calls the app's server with the signed-in account's Supabase access token, so the server can check who is asking.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await accessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
