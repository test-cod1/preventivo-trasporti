// ============================================================
//  CONFIGURAZIONE — Preventivo Trasporti Sanitari CRI
// ============================================================
// MODE:
//   'supabase' -> dati nel cloud Supabase (multi-utente, storico, backup).
//   'local'    -> dati nel browser (IndexedDB): utile per provare l'app
//                 senza account. Attivabile al volo con ?mode=local nell'URL.
//
// NOTA: progetto Supabase dedicato "CRIGenova's Org / preventivo-trasporti"
// (regione UE eu-west-1). Tabelle: profili, preventivi, impostazioni_trasferte.
// ============================================================

const _override = new URLSearchParams(location.search).get('mode');

export const CONFIG = {
  MODE: _override || 'supabase',

  supabase: {
    url: 'https://qgqjczswthmfxltztmgi.supabase.co',
    anonKey: 'sb_publishable_Xodp3IgxM5qRx6Q_8LZzDQ_38lV7gfo',
  },

  // ---- Punto di partenza FISSO (sede CRI) --------------------------------
  // Ogni preventivo parte sempre da qui. Le coordinate sono un fallback:
  // il geocoder OpenRouteService le riconferma comunque.
  partenza: {
    label: 'Sede CRI — Corso Aldo Gastaldi 11, Genova',
    indirizzo: 'Corso Aldo Gastaldi 11, 16145 Genova, Italia',
    lon: 8.96999,
    lat: 44.40560,
  },

  // ---- Endpoint serverless (Cloudflare Pages Functions) ------------------
  // Fanno da proxy verso OpenRouteService tenendo la chiave lato server.
  api: {
    geocode: '/api/geocode',
    route: '/api/route',
  },
};
