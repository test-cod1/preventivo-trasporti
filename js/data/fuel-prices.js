// ============================================================
//  PREZZI CARBURANTE EUROPEI — valori di riferimento (default)
// ------------------------------------------------------------
//  Fonte: medie nazionali stile "Weekly Oil Bulletin" della
//  Commissione Europea, rilevate il 3 agosto 2026.
//  Prezzi in EUR/litro. Sono valori DI DEFAULT: nel gestionale
//  puoi sempre correggere il prezzo manualmente prima di salvare,
//  e nelle Impostazioni puoi aggiornare l'intera tabella.
//
//  Chiavi: ISO alpha-2 del Paese.
//  Campi:  nome (it), iso3, diesel (gasolio), benzina.
// ============================================================

export const FUEL_DATA_DATE = '2026-08-03';

export const FUEL_PRICES = {
  IT: { nome: 'Italia',                iso3: 'ITA', diesel: 2.101, benzina: 2.005 },
  AL: { nome: 'Albania',               iso3: 'ALB', diesel: 2.203, benzina: 2.021 },
  AD: { nome: 'Andorra',               iso3: 'AND', diesel: 1.606, benzina: 1.504 },
  AT: { nome: 'Austria',               iso3: 'AUT', diesel: 2.050, benzina: 1.839 },
  BY: { nome: 'Bielorussia',           iso3: 'BLR', diesel: 0.795, benzina: 0.795 },
  BE: { nome: 'Belgio',                iso3: 'BEL', diesel: 2.135, benzina: 1.791 },
  BA: { nome: 'Bosnia ed Erzegovina',  iso3: 'BIH', diesel: 1.692, benzina: 1.488 },
  BG: { nome: 'Bulgaria',              iso3: 'BGR', diesel: 1.710, benzina: 1.515 },
  HR: { nome: 'Croazia',               iso3: 'HRV', diesel: 1.771, benzina: 1.617 },
  CY: { nome: 'Cipro',                 iso3: 'CYP', diesel: 1.721, benzina: 1.571 },
  CZ: { nome: 'Repubblica Ceca',       iso3: 'CZE', diesel: 1.814, benzina: 1.745 },
  DK: { nome: 'Danimarca',             iso3: 'DNK', diesel: 2.456, benzina: 2.323 },
  EE: { nome: 'Estonia',               iso3: 'EST', diesel: 1.732, benzina: 1.723 },
  FI: { nome: 'Finlandia',             iso3: 'FIN', diesel: 2.224, benzina: 2.166 },
  FR: { nome: 'Francia',               iso3: 'FRA', diesel: 2.216, benzina: 2.024 },
  DE: { nome: 'Germania',              iso3: 'DEU', diesel: 2.185, benzina: 2.109 },
  GR: { nome: 'Grecia',                iso3: 'GRC', diesel: 2.064, benzina: 2.021 },
  HU: { nome: 'Ungheria',              iso3: 'HUN', diesel: 1.714, benzina: 1.650 },
  IS: { nome: 'Islanda',               iso3: 'ISL', diesel: 1.689, benzina: 1.529 },
  IE: { nome: 'Irlanda',               iso3: 'IRL', diesel: 1.752, benzina: 1.758 },
  LV: { nome: 'Lettonia',              iso3: 'LVA', diesel: 1.969, benzina: 1.861 },
  LT: { nome: 'Lituania',              iso3: 'LTU', diesel: 1.940, benzina: 1.690 },
  LU: { nome: 'Lussemburgo',           iso3: 'LUX', diesel: 1.854, benzina: 1.709 },
  MT: { nome: 'Malta',                 iso3: 'MLT', diesel: 1.210, benzina: 1.340 },
  MD: { nome: 'Moldova',               iso3: 'MDA', diesel: 1.634, benzina: 1.527 },
  NL: { nome: 'Paesi Bassi',           iso3: 'NLD', diesel: 2.376, benzina: 2.376 },
  NO: { nome: 'Norvegia',              iso3: 'NOR', diesel: 1.975, benzina: 1.939 },
  PL: { nome: 'Polonia',               iso3: 'POL', diesel: 1.829, benzina: 1.730 },
  PT: { nome: 'Portogallo',            iso3: 'PRT', diesel: 2.050, benzina: 1.982 },
  RO: { nome: 'Romania',               iso3: 'ROU', diesel: 2.067, benzina: 1.818 },
  RU: { nome: 'Russia',                iso3: 'RUS', diesel: 0.878, benzina: 0.788 },
  SM: { nome: 'San Marino',            iso3: 'SMR', diesel: 1.878, benzina: 1.626 },
  RS: { nome: 'Serbia',                iso3: 'SRB', diesel: 1.926, benzina: 1.722 },
  SK: { nome: 'Slovacchia',            iso3: 'SVK', diesel: 1.737, benzina: 1.765 },
  SI: { nome: 'Slovenia',              iso3: 'SVN', diesel: 1.882, benzina: 1.584 },
  ES: { nome: 'Spagna',                iso3: 'ESP', diesel: 1.833, benzina: 1.714 },
  SE: { nome: 'Svezia',                iso3: 'SWE', diesel: 1.802, benzina: 1.378 },
  CH: { nome: 'Svizzera',              iso3: 'CHE', diesel: 2.321, benzina: 2.105 },
  TR: { nome: 'Turchia',               iso3: 'TUR', diesel: 1.460, benzina: 1.227 },
  UA: { nome: 'Ucraina',               iso3: 'UKR', diesel: 1.823, benzina: 1.606 },
  GB: { nome: 'Regno Unito',           iso3: 'GBR', diesel: 2.091, benzina: 1.866 },
};

// alpha-3 -> alpha-2 (per mappare la risposta del geocoder ORS)
const ISO3_TO_ISO2 = Object.fromEntries(
  Object.entries(FUEL_PRICES).map(([k, v]) => [v.iso3, k])
);

// Ritorna il prezzo di riferimento per un Paese e tipo carburante.
// paese: ISO alpha-2 o alpha-3 (case-insensitive). tipo: 'diesel'|'benzina'.
export function prezzoRiferimento(paese, tipo = 'diesel', tabella = FUEL_PRICES) {
  if (!paese) return null;
  const p = String(paese).toUpperCase();
  const iso2 = p.length === 3 ? ISO3_TO_ISO2[p] : p;
  const row = tabella[iso2];
  if (!row) return null;
  return tipo === 'benzina' ? row.benzina : row.diesel;
}

export function paeseDaIso(paese, tabella = FUEL_PRICES) {
  if (!paese) return null;
  const p = String(paese).toUpperCase();
  const iso2 = p.length === 3 ? ISO3_TO_ISO2[p] : p;
  return tabella[iso2] ? { iso2, ...tabella[iso2] } : null;
}
