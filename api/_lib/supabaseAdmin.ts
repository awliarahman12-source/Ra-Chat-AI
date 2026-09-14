import { createClient } from '@supabase/supabase-js';

// SUPABASE_SERVICE_ROLE_KEY is intentionally NOT prefixed with VITE_, so
// Vite never bundles it into client-side JS — it only ever exists in this
// server-side function's environment.
const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

export function getAdminClient() {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getAnonClient() {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}
