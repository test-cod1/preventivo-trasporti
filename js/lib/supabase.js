// Caricatore lazy del client Supabase (da CDN, solo se MODE = 'supabase').
import { CONFIG } from '../config.js';

let _client = null;

// Versione fissata (non "@2"): un aggiornamento automatico della libreria
// lato CDN potrebbe altrimenti cambiare comportamento da un giorno all'altro
// senza che il codice del progetto sia cambiato, o — in caso di CDN
// compromesso — eseguire codice diverso da quello verificato qui.
// Per aggiornare: cambiare questo numero dopo aver testato la nuova versione.
const SUPABASE_JS_VERSION = '2.112.3';

export async function getSupabase() {
  if (_client) return _client;
  const { createClient } = await import(`https://esm.sh/@supabase/supabase-js@${SUPABASE_JS_VERSION}`);
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
