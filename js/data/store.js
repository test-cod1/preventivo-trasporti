// ============================================================
//  DATA LAYER — interfaccia unica, due backend: 'local' e 'supabase'
//  Entità: preventivi + impostazioni (singleton) + auth
// ============================================================
import { CONFIG } from '../config.js';
import { DEFAULT_IMPOSTAZIONI } from '../calc.js';

const MODE = CONFIG.MODE;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const nowISO = () => new Date().toISOString();

// ---------------------------------------------------------------
//  IndexedDB (modalità locale)
// ---------------------------------------------------------------
const DB_NAME = 'preventivo-trasporti';
const STORES = ['preventivi', 'impostazioni', 'meta'];
let _db = null;

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = (store, mode = 'readonly') => _db.transaction(store, mode).objectStore(store);
const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const idbAll = (s) => reqP(tx(s).getAll());
const idbGet = (s, id) => reqP(tx(s).get(id));
const idbPut = (s, o) => reqP(tx(s, 'readwrite').put(o));
const idbDel = (s, id) => reqP(tx(s, 'readwrite').delete(id));

export async function initStore() {
  if (MODE === 'local') _db = await openDB();
}

// ---------------------------------------------------------------
//  AUTH
// ---------------------------------------------------------------
export const auth = {
  async current() {
    if (MODE === 'local') {
      const u = localStorage.getItem('pt-user');
      return u ? JSON.parse(u) : null;
    }
    const sb = await sbClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const prof = await sbProfile(sb, data.user.id);
    return { id: data.user.id, email: data.user.email, nome: prof?.nome || data.user.email, ruolo: prof?.ruolo || 'lettore' };
  },
  async signIn(email, password) {
    if (MODE === 'local') {
      const user = { id: 'local', email: email || 'demo@cri.it', nome: email ? email.split('@')[0] : 'Demo', ruolo: 'admin' };
      localStorage.setItem('pt-user', JSON.stringify(user));
      return user;
    }
    const sb = await sbClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const prof = await sbProfile(sb, data.user.id);
    return { id: data.user.id, email: data.user.email, nome: prof?.nome || data.user.email, ruolo: prof?.ruolo || 'lettore' };
  },
  async signOut() {
    if (MODE === 'local') { localStorage.removeItem('pt-user'); return; }
    const sb = await sbClient(); await sb.auth.signOut();
  },
  // Invia l'email col link per reimpostare la password.
  async resetPassword(email) {
    if (MODE === 'local') throw new Error('Recupero password non disponibile in modalità locale.');
    const sb = await sbClient();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname,
    });
    if (error) throw error;
  },
  // Imposta la nuova password (valida solo dentro la sessione di recupero).
  async updatePassword(nuovaPassword) {
    if (MODE === 'local') throw new Error('Non disponibile in modalità locale.');
    const sb = await sbClient();
    const { error } = await sb.auth.updateUser({ password: nuovaPassword });
    if (error) throw error;
  },
};

// ---------------------------------------------------------------
//  PREVENTIVI
// ---------------------------------------------------------------
export const preventivi = {
  async list() {
    if (MODE === 'local') {
      return (await idbAll('preventivi')).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }
    const sb = await sbClient();
    const { data, error } = await sb.from('preventivi').select('*').order('created_at', { ascending: false });
    if (error) throw error; return data;
  },
  async get(id) {
    if (MODE === 'local') return idbGet('preventivi', id);
    const sb = await sbClient();
    const { data, error } = await sb.from('preventivi').select('*').eq('id', id).single();
    if (error) throw error; return data;
  },
  async save(rec) {
    const isNew = !rec.id;
    rec = { id: rec.id || uid(), created_at: rec.created_at || nowISO(), ...rec, updated_at: nowISO() };
    if (MODE === 'local') { await idbPut('preventivi', rec); return rec; }
    const sb = await sbClient();
    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) rec.created_by = rec.created_by || u.user.id;
    }
    const { data, error } = await sb.from('preventivi').upsert(rec).select().single();
    if (error) throw error; return data;
  },
  async remove(id) {
    if (MODE === 'local') return idbDel('preventivi', id);
    const sb = await sbClient();
    const { error } = await sb.from('preventivi').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------
//  IMPOSTAZIONI (singleton "default")
// ---------------------------------------------------------------
export const impostazioni = {
  async get() {
    let dati = null;
    if (MODE === 'local') {
      const row = await idbGet('impostazioni', 'default');
      dati = row?.dati || null;
    } else {
      const sb = await sbClient();
      const { data } = await sb.from('impostazioni_trasferte').select('*').eq('id', 'default').maybeSingle();
      dati = data?.dati || null;
    }
    // merge coi default per tollerare nuove chiavi
    return mergeImpostazioni(dati);
  },
  async save(dati) {
    const clean = mergeImpostazioni(dati);
    if (MODE === 'local') { await idbPut('impostazioni', { id: 'default', dati: clean, updated_at: nowISO() }); return clean; }
    const sb = await sbClient();
    const { error } = await sb.from('impostazioni_trasferte').upsert({ id: 'default', dati: clean, updated_at: nowISO() });
    if (error) throw error; return clean;
  },
};

function mergeImpostazioni(dati) {
  if (!dati) return structuredClone(DEFAULT_IMPOSTAZIONI);
  return {
    ...structuredClone(DEFAULT_IMPOSTAZIONI),
    ...dati,
    mezzi: Array.isArray(dati.mezzi) && dati.mezzi.length ? dati.mezzi : DEFAULT_IMPOSTAZIONI.mezzi,
    // la tabella prezzi carburante personalizzata è opzionale
    prezziCustom: dati.prezziCustom || null,
  };
}

// ---------------------------------------------------------------
//  helpers supabase
// ---------------------------------------------------------------
async function sbClient() { const { getSupabase } = await import('../lib/supabase.js'); return getSupabase(); }
async function sbProfile(sb, userId) {
  const { data } = await sb.from('profili').select('*').eq('id', userId).single();
  return data;
}

export { MODE };
