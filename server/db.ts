// Server-side database access (Supabase, service-role key). It verifies who is calling and reads/writes data that
// browsers are not allowed to touch (e.g. WordPress keys, the audit log). The service role is not limited by the
// Row Level Security rules in supabase/migrations.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { TABLE_COLUMNS, Table, fromRow, toRow } from '../src/lib/rows';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !serviceKey) {
  console.error('Supabase is not configured: set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (see .env.example).');
}

export const supabaseAdmin = createClient(url || 'http://localhost', serviceKey || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE = 1000;
type Filters = Record<string, string | number | boolean | null>;

function fail(table: string, action: string, error: { message: string }): never {
  throw new Error(`Database ${action} on ${table} failed: ${error.message}`);
}

const column = (table: Table, field: string) => {
  if (!(TABLE_COLUMNS[table] as readonly string[]).includes(field)) throw new Error(`${table} has no field ${field}`);
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
};

export async function getRow<T = any>(table: Table, id: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin.from(table).select('*').eq('id', id).maybeSingle();
  if (error) fail(table, 'read', error);
  return data ? fromRow<T>(data) : null;
}

// All rows matching the filters (field = value), read in pages so large tables are complete
export async function findRows<T = any>(table: Table, filters: Filters = {}): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabaseAdmin.from(table).select('*').order('id').range(from, from + PAGE - 1);
    for (const [field, value] of Object.entries(filters)) {
      query = value === null ? query.is(column(table, field), null) : query.eq(column(table, field), value);
    }
    const { data, error } = await query;
    if (error) fail(table, 'read', error);
    rows.push(...(data || []).map((r) => fromRow<T>(r)));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function insertRow<T = any>(table: Table, record: Record<string, any>): Promise<T> {
  const { data, error } = await supabaseAdmin.from(table).insert(toRow(table, record)).select('*').single();
  if (error) fail(table, 'insert', error);
  return fromRow<T>(data);
}

// Create or replace the fields given (other fields of an existing row are kept)
export async function upsertRow(table: Table, record: Record<string, any>) {
  const { error } = await supabaseAdmin.from(table).upsert(toRow(table, record));
  if (error) fail(table, 'save', error);
}

// Change some fields; returns the updated row, or null when there is no such row
export async function updateRow<T = any>(table: Table, id: string, patch: Record<string, any>): Promise<T | null> {
  const { data, error } = await supabaseAdmin.from(table).update(toRow(table, patch)).eq('id', id).select('*').maybeSingle();
  if (error) fail(table, 'update', error);
  return data ? fromRow<T>(data) : null;
}

export async function deleteRow(table: Table, id: string) {
  const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
  if (error) fail(table, 'delete', error);
}

// Workspace settings (one row each: access, branding, permissions, chat, aiPricing)
export async function getSetting<T extends object = Record<string, any>>(id: string): Promise<Partial<T>> {
  const { data, error } = await supabaseAdmin.from('settings').select('value').eq('id', id).maybeSingle();
  if (error) fail('settings', 'read', error);
  return (data?.value || {}) as Partial<T>;
}

export async function mergeSetting(id: string, patch: Record<string, any>) {
  const { error } = await supabaseAdmin.rpc('settings_merge', { p_id: id, p_patch: patch });
  if (error) fail('settings', 'save', error);
}

export async function replaceSetting(id: string, value: Record<string, any>) {
  const { error } = await supabaseAdmin.from('settings').upsert({ id, value, updated_at: new Date().toISOString() });
  if (error) fail('settings', 'save', error);
}

export const now = () => new Date().toISOString();
