// ============================================================
//  MOTORE DI CALCOLO DEL PREVENTIVO
// ------------------------------------------------------------
//  Ricalca la logica dello storico foglio Excel "conto trasferte"
//  e la estende. Produce SEMPRE due totali affiancati:
//    • SPESA REALE  = costo effettivo sostenuto (rimborso vivo)
//    • ADDEBITO     = km × tariffa + voci ribaltate (quello che si chiede)
//    • MARGINE      = addebito − spesa reale
// ============================================================

import { FUEL_DATA_DATE } from './data/fuel-prices.js';

// ---- Impostazioni di default (modificabili in app) ---------------------
export const DEFAULT_IMPOSTAZIONI = {
  // Parco mezzi con consumo medio (km/litro) e alimentazione.
  // Valori di consumo presi dallo storico Excel.
  mezzi: [
    { id: 'ambulanza', nome: 'Ambulanza',  alimentazione: 'diesel',  consumo: 9.4 },
    { id: 'doblo',     nome: 'Doblò',       alimentazione: 'diesel',  consumo: 12 },
    { id: 'vettura',   nome: 'Vettura',     alimentazione: 'benzina', consumo: 13 },
  ],

  // In Italia la CRI è esente da pedaggi: si applicano SOLO ai viaggi
  // all'estero. Stima €/km di riferimento per i pedaggi/vignette esteri.
  pedaggiEsteroKm: 0.10,

  pastoCosto: 25,        // € a pasto a persona (Excel: 25)
  tariffaKm: 1.20,       // € / km per l'addebito (Excel usava 1,15 e 1,20)
  medicoTariffaOraria: 50, // €/ora indicativa per il medico al seguito (modificabile)

  // AdBlue (solo mezzi diesel): stima come % dei litri di gasolio consumati.
  adBluePerc: 4,         // % del volume di gasolio
  adBluePrezzo: 1.00,    // € / litro AdBlue

  // Quali voci vengono "ribaltate" (aggiunte) sull'addebito oltre al km×tariffa.
  // Carburante e AdBlue NON si ribaltano: sono coperti dalla tariffa al km.
  ribalta: {
    pasti: true,
    pernottamento: true,
    medico: true,
    pedaggi: true,
    materiale: true,
  },

  fuelDataDate: FUEL_DATA_DATE,
};

// ---- Input di default per un nuovo preventivo --------------------------
// Un nuovo preventivo parte AZZERATO: l'unica voce precompilata è il
// costo del pasto a persona (una costante di listino). Tutto il resto è 0,
// così l'operatore compila solo ciò che serve per il viaggio specifico.
export function nuovoInput(imp = DEFAULT_IMPOSTAZIONI) {
  return {
    kmTotali: 0,
    mezzoId: imp.mezzi[0]?.id || 'ambulanza',
    alimentazione: imp.mezzi[0]?.alimentazione || 'diesel',
    prezzoCarburante: null,        // €/l, precompilato dal Paese di destinazione
    persone: 0,
    pastiPersona: 0,
    pastoCosto: imp.pastoCosto,    // UNICA voce non azzerata
    pastiOn: false,         // sezione Pasti disattivata di default (interruttore in Itinerario)
    notti: 0,
    camere: 0,
    prezzoCameraNotte: 0,          // € a camera a notte
    prezzoPersonaNotte: 0,         // € a persona a notte (opzionale)
    pernottamentoOn: false, // sezione Pernottamento disattivata di default
    medico: 0,              // totale medico (auto = ore x tariffa oraria, sempre modificabile)
    medicoOre: 0,           // ore stimate dalla durata del percorso (modificabili)
    medicoOraria: imp.medicoTariffaOraria, // €/ora, modificabile
    medicoOn: false,        // sezione Medico disattivata di default
    estero: false,          // viaggio fuori Italia -> abilita i pedaggi/vignette
    pedaggi: 0,             // pedaggi/vignette esteri (0 e nascosti in Italia)
    adBlueOn: false,
    adBluePrezzo: imp.adBluePrezzo,
    adBluePerc: imp.adBluePerc,
    materiale: [],                 // [{ desc, importo }]
    tariffaKm: 0,                  // azzerata: si imposta con i preset o a mano
    ribalta: { ...imp.ribalta },
  };
}

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

// ---- Calcolo principale -----------------------------------------------
export function calcola(input, imp = DEFAULT_IMPOSTAZIONI) {
  const mezzo = imp.mezzi.find(m => m.id === input.mezzoId) || imp.mezzi[0] || { consumo: 10, alimentazione: 'diesel' };
  const consumo = n(mezzo.consumo) || 10;
  const km = n(input.kmTotali);

  // --- Carburante ---
  const litri = consumo > 0 ? km / consumo : 0;
  const carburante = litri * n(input.prezzoCarburante);

  // --- AdBlue (solo diesel, se attivo) ---
  const isDiesel = (input.alimentazione || mezzo.alimentazione) === 'diesel';
  const litriAdBlue = input.adBlueOn && isDiesel ? litri * (n(input.adBluePerc) / 100) : 0;
  const adBlue = litriAdBlue * n(input.adBluePrezzo);

  // --- Pasti (sezione disattivabile: conta solo se pastiOn) ---
  const pasti = input.pastiOn ? n(input.persone) * n(input.pastiPersona) * n(input.pastoCosto) : 0;

  // --- Pernottamento (sezione disattivabile: conta solo se pernottamentoOn) ---
  const pernCamere = input.pernottamentoOn ? n(input.notti) * n(input.camere) * n(input.prezzoCameraNotte) : 0;
  const pernPersone = input.pernottamentoOn ? n(input.notti) * n(input.persone) * n(input.prezzoPersonaNotte) : 0;
  const pernottamento = pernCamere + pernPersone;

  // --- Extra (Medico: sezione disattivabile, conta solo se medicoOn) ---
  const medico = input.medicoOn ? n(input.medico) : 0;
  // In Italia niente pedaggi (CRI esente): contano solo se estero attivo.
  const pedaggi = input.estero ? n(input.pedaggi) : 0;
  const materiale = (input.materiale || []).reduce((s, r) => s + n(r.importo), 0);

  // --- SPESA REALE (costo vivo) ---
  const spesaReale = carburante + adBlue + pasti + pernottamento + medico + pedaggi + materiale;

  // --- ADDEBITO (km × tariffa + voci ribaltate) ---
  const addebitoKm = km * n(input.tariffaKm);
  const rib = input.ribalta || {};
  const passthrough =
    (rib.pasti ? pasti : 0) +
    (rib.pernottamento ? pernottamento : 0) +
    (rib.medico ? medico : 0) +
    (rib.pedaggi ? pedaggi : 0) +
    (rib.materiale ? materiale : 0);
  const addebito = addebitoKm + passthrough;

  const margine = addebito - spesaReale;

  return {
    litri, carburante, adBlue, litriAdBlue,
    pasti, pernottamento, pernCamere, pernPersone,
    medico, pedaggi, materiale,
    spesaReale,
    addebitoKm, passthrough, addebito,
    margine,
    margineperc: spesaReale > 0 ? (margine / spesaReale) * 100 : null,
    tariffaEffettiva: km > 0 ? addebito / km : null,
    consumo, isDiesel,
  };
}
