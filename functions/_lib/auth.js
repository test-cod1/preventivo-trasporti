// ============================================================
//  Verifica sessione Supabase per le Cloudflare Pages Functions
// ------------------------------------------------------------
//  Le Function di questo progetto (geocode/route) proxano OpenRouteService
//  tenendo la chiave ORS lato server. Senza questo controllo erano endpoint
//  pubblici: chiunque conoscesse l'URL poteva interrogarle in loop ed
//  esaurire la quota giornaliera della chiave, bloccando l'app per tutti.
//
//  Si convalida il token passando dall'endpoint /auth/v1/user di Supabase:
//  verifica firma, scadenza e revoca senza bisogno del JWT secret (che
//  resta privato lato Supabase). L'anon key qui sotto è la stessa già
//  pubblica in js/config.js (per design non è un segreto).
// ============================================================

const SUPABASE_URL = 'https://qgqjczswthmfxltztmgi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Xodp3IgxM5qRx6Q_8LZzDQ_38lV7gfo';

// Ritorna l'utente Supabase se il token nell'header Authorization è valido,
// altrimenti null.
export async function requireUser(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const url = (env && env.SUPABASE_URL) || SUPABASE_URL;
  const anonKey = (env && env.SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY;

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
