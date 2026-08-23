// Caricatore lazy del client Supabase (da CDN, solo se MODE = 'supabase').
import { CONFIG } from '../config.js';

let _client = null;

export async function getSupabase() {
  if (_client) return _client;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  _client = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
  return _client;
}

// Token della sessione corrente, da allegare come Authorization alle
// Cloudflare Pages Functions (/api/geocode, /api/route) così sanno che la
// richiesta arriva da un utente loggato. null se non c'è sessione (es. modo
// locale demo, dove queste chiamate resteranno rifiutate).
export async function getAccessToken() {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || null;
}
