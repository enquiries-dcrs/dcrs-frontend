import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let browserClient: SupabaseClient | null = null;

function isPlaceholder(value: string): boolean {
  const v = value.trim();
  return v === '' || v === '...' || v.toLowerCase() === 'changeme';
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Single browser Supabase client so auth/session state is shared with API interceptors
 * and the sign-in page (avoids multiple GoTrueClient instances on the same storage key).
 * Returns null on the server or when env is missing / invalid.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (
    isPlaceholder(supabaseUrl) ||
    isPlaceholder(supabaseAnonKey) ||
    !isValidHttpUrl(supabaseUrl)
  ) {
    return null;
  }
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}
