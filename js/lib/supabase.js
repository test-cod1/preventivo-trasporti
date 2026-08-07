// Caricatore lazy del client Supabase (da CDN, solo se MODE = 'supabase').
import { CONFIG } from '../config.js';

let _client = null;

export async function getSupabase() {
  if (_client) return _client;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  _client = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
  return _client;
}
