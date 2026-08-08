import { preventivi, MODE } from '../data/store.js';
import { calcola, nuovoInput } from '../calc.js';
import { CONFIG } from '../config.js';
import { geocode, route, RoutingError } from '../lib/routing.js';
import { prezzoRiferimento, paeseDaIso } from '../data/fuel-prices.js';
import { stampaPreventivo } from '../lib/pdf.js';
import { el, clear, esc, fmtEuro, fmtNum, fmtKm, toast, debounce, confirmDialog } from '../lib/ui.js';

export async function renderPreventivo(view, id, ctx) {
  const imp = ctx.imp;
  clear(view);

  // ---- carica o crea ----
  let prev;
  if (id) {
    prev = await preventivi.get(id);
    if (!prev) { view.appendChild(el('<div class="empty-state"><div class="big">❓</div><p>Preventivo non trovato.</p></div>')); return; }
    prev.input = { ...nuovoInput(imp), ...(prev.input || {}) };
    prev.tappe = prev.tappe || [];
  } else {
    prev = {
      titolo: '', note: '',
      tappe: [emptyTappa()],
      andata_ritorno: true, km_auto: true,
      input: nuovoInput(imp),
      paese_dest: 'IT', paese_dest_nome: 'Italia',
    };
    // prezzo iniziale = Italia diesel
    prev.input.prezzoCarburante = prezzoRiferimento('IT', prev.input.alimentazione, tabella(imp));
  }
  let prezzoAuto = prev._prezzoAuto !== false; // di default il prezzo segue il Paese
  let pedaggioAuto = prev._pedaggioAuto !== false; // stima pedaggi estero attiva finché non la modifichi a mano
  let esteroAuto = prev._esteroAuto !== false;     // il flag "estero" segue la destinazione finché non lo forzi a mano

  // ---- layout ----
  const head = el(`<div class="page-head">
    <div>
      <h1>${id ? 'Modifica preventivo' : 'Nuovo preventivo'}</h1>
      <p>Partenza fissa: <b>${esc(CONFIG.partenza.label)}</b></p>
    </div>
    <div class="inline">
      <a class="btn" href="#/preventivi">← Elenco</a>
      <button class="btn" id="btn-pdf">🖨️ Stampa / PDF</button>
      <button class="btn primary" id="btn-save">💾 Salva</button>
    </div>
  </div>`);
  view.appendChild(head);

  const editor = el(`<div class="editor">
    <div class="col-main"></div>
    <div class="summary"></div>
  </div>`);
  view.appendChild(editor);
  const main = editor.querySelector('.col-main');
  const summaryCol = editor.querySelector('.summary');

  // ================= SEZIONE 2: ITINERARIO =================
  const cItin = card('Itinerario e chilometri', '');
  main.appendChild(cItin);
  const itinBody = cItin.querySelector('.card-b');
  renderItinerario();

  // ================= SEZIONE 3: MEZZO E CARBURANTE =================
  const cMezzo = card('Mezzo e carburante', `
    <div class="form-row three">
      <div class="field"><label>Mezzo</label><select id="mezzo">
        ${imp.mezzi.map(m => `<option value="${m.id}" ${prev.input.mezzoId===m.id?'selected':''}>${esc(m.nome)} — ${fmtNum(m.consumo,1)} km/l</option>`).join('')}
      </select><div class="hint" id="mezzo-hint"></div></div>
      <div class="field"><label>Alimentazione</label><select id="alim">
        <option value="diesel">Gasolio (diesel)</option>
        <option value="benzina">Benzina</option>
      </select></div>
      <div class="field">
        <label>Prezzo carburante (€/l) <span class="badge-auto" id="badge-auto">auto</span></label>
        <input type="number" step="0.001" id="prezzoCarb">
        <div class="hint" id="carb-hint"></div>
      </div>
    </div>`);
  main.appendChild(cMezzo);

  // ================= SEZIONE 4: EQUIPAGGIO E PASTI =================
  const cEq = card('Equipaggio e pasti', `
    <div class="form-row three">
      <div class="field"><label>Persone in squadra</label><input type="number" min="0" id="persone" value="${prev.input.persone}"></div>
      <div class="field"><label>Pasti a persona</label><input type="number" min="0" id="pastiPersona" value="${prev.input.pastiPersona}"></div>
      <div class="field"><label>Costo a pasto (€)</label><input type="number" min="0" step="0.5" id="pastoCosto" value="${prev.input.pastoCosto}"></div>
    </div>`);
  main.appendChild(cEq);

  // ================= SEZIONE 5: PERNOTTAMENTO =================
  const cPern = card('Pernottamento', `
    <div class="form-row three">
      <div class="field"><label>Notti</label><input type="number" min="0" id="notti" value="${prev.input.notti}"></div>
      <div class="field"><label>N. camere</label><input type="number" min="0" id="camere" value="${prev.input.camere}"></div>
      <div class="field"><label>€ a camera / notte</label><input type="number" min="0" step="0.5" id="prezzoCameraNotte" value="${prev.input.prezzoCameraNotte}"></div>
    </div>
    <div class="field"><label>€ a persona / notte (opzionale, alternativo alle camere)</label><input type="number" min="0" step="0.5" id="prezzoPersonaNotte" value="${prev.input.prezzoPersonaNotte}"></div>`);
  main.appendChild(cPern);

  // ================= SEZIONE 6: ALTRE VOCI =================
  const cExtra = card('Altre voci', `
    <div class="form-row three">
      <div class="field"><label>Medico al seguito (€)</label><input type="number" min="0" step="1" id="medico" value="${prev.input.medico}"></div>
      <div class="field"><label>&nbsp;</label>
        <label class="chk"><input type="checkbox" id="adblue" ${prev.input.adBlueOn?'checked':''}> AdBlue (stima su gasolio)</label>
      </div>
      <div class="field"><label>&nbsp;</label>
        <label class="chk"><input type="checkbox" id="estero" ${prev.input.estero?'checked':''}> Viaggio all'estero (pedaggi/vignette)</label>
      </div>
    </div>
    <div id="adblue-row" class="form-row" style="${prev.input.adBlueOn?'':'display:none'}">
      <div class="field"><label>AdBlue: % del gasolio</label><input type="number" min="0" step="0.5" id="adBluePerc" value="${prev.input.adBluePerc}"></div>
      <div class="field"><label>AdBlue: €/l</label><input type="number" min="0" step="0.01" id="adBluePrezzo" value="${prev.input.adBluePrezzo}"></div>
    </div>
    <div id="estero-row" class="form-row" style="${prev.input.estero?'':'display:none'}">
      <div class="field"><label>Pedaggi / vignette estero (€) <span class="badge-auto" id="badge-pedaggio">stima</span></label>
        <input type="number" min="0" step="0.5" id="pedaggi" value="${prev.input.pedaggi}">
        <div class="hint" id="pedaggio-hint"></div></div>
      <div class="field"></div>
    </div>
    <label class="section-t" style="margin-top:6px">Materiale di consumo</label>
    <div id="materiale"></div>
    <button class="btn sm" id="add-mat" type="button">➕ Aggiungi voce</button>`);
  main.appendChild(cExtra);
  renderMateriale();

  // ================= SEZIONE 7: TARIFFA =================
  const cTar = card('Tariffa per l\'addebito', `
    <div class="form-row">
      <div class="field"><label>Tariffa € / km</label><input type="number" min="0" step="0.05" id="tariffaKm" value="${prev.input.tariffaKm}">
        <div class="hint">L'addebito = km × tariffa + le voci ribaltate. Copre carburante, usura mezzo e servizio.</div></div>
      <div class="field"><label>Preset rapidi</label>
        <div class="pill-toggle" id="tariffa-preset">
          <button type="button" data-t="1.15">1,15</button>
          <button type="button" data-t="1.20">1,20</button>
          <button type="button" data-t="1.30">1,30</button>
        </div>
      </div>
    </div>
    <label class="section-t" style="margin-top:6px">Voci ribaltate sull'addebito (a rimborso, oltre al km)</label>
    <div id="ribalta"></div>`);
  main.appendChild(cTar);
  renderRibalta();

  const cNote = card('Note', `<textarea id="note" rows="3" placeholder="Note per il preventivo (visibili in stampa)…">${esc(prev.note || '')}</textarea>`);
  main.appendChild(cNote);

  // ---------------- BINDINGS ----------------
  const $ = (sel) => view.querySelector(sel);
  bind('#note', v => prev.note = v, 'text');

  $('#mezzo').addEventListener('change', e => {
    prev.input.mezzoId = e.target.value;
    const m = imp.mezzi.find(x => x.id === e.target.value);
    if (m) { prev.input.alimentazione = m.alimentazione; $('#alim').value = m.alimentazione; }
    if (prezzoAuto) refillPrezzo();
    updateMezzoHint(); recalc();
  });
  $('#alim').value = prev.input.alimentazione;
  $('#alim').addEventListener('change', e => { prev.input.alimentazione = e.target.value; if (prezzoAuto) refillPrezzo(); recalc(); });

  $('#prezzoCarb').value = prev.input.prezzoCarburante ?? '';
  $('#prezzoCarb').addEventListener('input', e => {
    prev.input.prezzoCarburante = num(e.target.value);
    prezzoAuto = false; $('#badge-auto').style.display = 'none'; recalc();
  });

  bindNum('#persone', 'persone');
  bindNum('#pastiPersona', 'pastiPersona');
  bindNum('#pastoCosto', 'pastoCosto');
  bindNum('#notti', 'notti');
  bindNum('#camere', 'camere');
  bindNum('#prezzoCameraNotte', 'prezzoCameraNotte');
  bindNum('#prezzoPersonaNotte', 'prezzoPersonaNotte');
  $('#pedaggi').value = prev.input.pedaggi || '';
  $('#pedaggi').addEventListener('input', e => {
    prev.input.pedaggi = num(e.target.value);
    pedaggioAuto = false;
    const b = $('#badge-pedaggio'); if (b) b.style.display = 'none';
    const h = $('#pedaggio-hint'); if (h) h.textContent = 'Valore inserito a mano.';
    recalc();
  });
  bindNum('#medico', 'medico');
  bindNum('#adBluePerc', 'adBluePerc');
  bindNum('#adBluePrezzo', 'adBluePrezzo');
  bindNum('#tariffaKm', 'tariffaKm');

  $('#adblue').addEventListener('change', e => {
    prev.input.adBlueOn = e.target.checked;
    $('#adblue-row').style.display = e.target.checked ? '' : 'none';
    recalc();
  });
  $('#estero').addEventListener('change', e => {
    esteroAuto = false; // scelta manuale: non seguire più la destinazione
    setEstero(e.target.checked);
    recalc();
  });
  $('#add-mat').addEventListener('click', () => { prev.input.materiale.push({ desc: '', importo: 0 }); renderMateriale(); recalc(); });
  view.querySelector('#tariffa-preset').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    prev.input.tariffaKm = Number(b.dataset.t); $('#tariffaKm').value = b.dataset.t; recalc();
  });

  head.querySelector('#btn-save').addEventListener('click', save);
  head.querySelector('#btn-pdf').addEventListener('click', () => { syncItinerario(); prev.risultato = calcola(prev.input, imp); stampaPreventivo({ ...prev }, imp); });

  updateMezzoHint();
  updateCarbHint();
  initEsteroPedaggio();
  recalc();

  // ================================================================
  //  ITINERARIO
  // ================================================================
  function renderItinerario() {
    clear(itinBody);
    const box = el('<div class="tappe"></div>');
    // partenza fissa
    box.appendChild(el(`<div class="tappa fissa">
      <div class="marker">P</div>
      <div class="body"><div class="locked">📍 ${esc(CONFIG.partenza.label)}</div></div>
    </div>`));
    // tappe destinazione
    prev.tappe.forEach((t, i) => box.appendChild(tappaRow(t, i)));
    itinBody.appendChild(box);

    const controls = el(`<div>
      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn sm" id="add-tappa" type="button">➕ Aggiungi tappa</button>
        <label class="chk"><input type="checkbox" id="ar" ${prev.andata_ritorno?'checked':''}> Andata e ritorno (rientro alla sede)</label>
        <button class="btn primary sm" id="calc-km" type="button">🧭 Calcola km e percorso</button>
      </div>
      <div class="form-row" style="margin-top:12px">
        <div class="field"><label>Km totali</label><input type="number" min="0" id="kmTotali" value="${prev.input.kmTotali||''}">
          <div class="hint" id="km-hint">Puoi calcolarli automaticamente o inserirli a mano.</div></div>
        <div class="field"></div>
      </div>
    </div>`);
    itinBody.appendChild(controls);

    controls.querySelector('#add-tappa').addEventListener('click', () => { prev.tappe.push(emptyTappa()); renderItinerario(); });
    controls.querySelector('#ar').addEventListener('change', e => { prev.andata_ritorno = e.target.checked; });
    controls.querySelector('#calc-km').addEventListener('click', calcolaKm);
    const kmInput = controls.querySelector('#kmTotali');
    kmInput.addEventListener('input', e => {
      prev.input.kmTotali = num(e.target.value); prev.km_auto = false;
      if (prev.input.estero && pedaggioAuto) refillPedaggio();
      recalc();
    });
  }

  function tappaRow(t, i) {
    const isLast = i === prev.tappe.length - 1;
    const row = el(`<div class="tappa">
      <div class="marker">${i + 1}</div>
      <div class="body">
        <input type="text" placeholder="Indirizzo destinazione${isLast ? ' finale' : ''} (città, via, Paese)…" value="${esc(t.label || '')}">
        <div class="ac" style="display:none"></div>
      </div>
      <button class="rm" title="Rimuovi" type="button">✕</button>
    </div>`);
    const input = row.querySelector('input');
    const acBox = row.querySelector('.ac');
    attachAutocomplete(input, acBox, (sel) => {
      Object.assign(t, sel);
      input.value = sel.label;
      onTappeChanged();
    });
    input.addEventListener('input', () => { t.label = input.value; t.lon = t.lat = null; });
    row.querySelector('.rm').addEventListener('click', () => {
      if (prev.tappe.length <= 1) { prev.tappe[0] = emptyTappa(); }
      else prev.tappe.splice(i, 1);
      renderItinerario(); onTappeChanged();
    });
    return row;
  }

  function onTappeChanged() {
    // Paese destinazione = ultima tappa con coordinate
    const dest = [...prev.tappe].reverse().find(t => t.iso2 || t.iso3);
    if (dest) {
      const info = paeseDaIso(dest.iso2 || dest.iso3, tabella(imp));
      if (info) { prev.paese_dest = info.iso2; prev.paese_dest_nome = info.nome; }
      else { prev.paese_dest = dest.iso2 || null; prev.paese_dest_nome = dest.paese || null; }
      if (prezzoAuto) refillPrezzo();
      if (esteroAuto) setEstero(!!(prev.paese_dest && prev.paese_dest !== 'IT'));
    }
    updateCarbHint();
    recalc();
  }

  async function calcolaKm() {
    const btn = view.querySelector('#calc-km');
    const stops = prev.tappe.filter(t => Number.isFinite(t.lon) && Number.isFinite(t.lat));
    if (!stops.length) { toast('Seleziona almeno una destinazione dall\'elenco suggerimenti.', 'err'); return; }
    const coords = [[CONFIG.partenza.lon, CONFIG.partenza.lat], ...stops.map(t => [t.lon, t.lat])];
    if (prev.andata_ritorno) coords.push([CONFIG.partenza.lon, CONFIG.partenza.lat]);
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Calcolo…';
    try {
      const r = await route(coords);
      prev.input.kmTotali = Math.round(r.distanceKm);
      prev.km_auto = true;
      view.querySelector('#kmTotali').value = prev.input.kmTotali;
      const h = Math.floor(r.durationMin / 60), m = Math.round(r.durationMin % 60);
      view.querySelector('#km-hint').innerHTML = `✅ ${fmtKm(prev.input.kmTotali)} · durata stimata ${h}h ${m}m ${prev.andata_ritorno ? '(a/r)' : '(sola andata)'}`;
      if (prev.input.estero && pedaggioAuto) refillPedaggio();
      recalc();
    } catch (e) {
      const msg = e instanceof RoutingError ? e.message : (e.message || 'Errore nel calcolo');
      view.querySelector('#km-hint').innerHTML = `<span style="color:var(--danger)">⚠️ ${esc(msg)} — inserisci i km a mano.</span>`;
      toast(msg, 'err');
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  function syncItinerario() {
    const kmEl = view.querySelector('#kmTotali');
    if (kmEl) prev.input.kmTotali = num(kmEl.value);
  }

  // ================================================================
  //  MATERIALE + RIBALTA
  // ================================================================
  function renderMateriale() {
    const box = view.querySelector('#materiale');
    clear(box);
    (prev.input.materiale || []).forEach((m, i) => {
      const r = el(`<div class="matrow">
        <input type="text" placeholder="Descrizione (es. orinale, DPI…)" value="${esc(m.desc || '')}">
        <input type="number" step="0.5" placeholder="€" value="${m.importo || ''}">
        <button class="rm btn ghost sm" type="button" title="Rimuovi">✕</button>
      </div>`);
      const [d, imp2] = r.querySelectorAll('input');
      d.addEventListener('input', () => { m.desc = d.value; });
      imp2.addEventListener('input', () => { m.importo = num(imp2.value); recalc(); });
      r.querySelector('.rm').addEventListener('click', () => { prev.input.materiale.splice(i, 1); renderMateriale(); recalc(); });
      box.appendChild(r);
    });
  }

  function renderRibalta() {
    const box = view.querySelector('#ribalta');
    clear(box);
    const voci = [
      ['pasti', 'Pasti'], ['pernottamento', 'Pernottamento'],
      ['medico', 'Medico al seguito'], ['materiale', 'Materiale di consumo'],
    ];
    if (prev.input.estero) voci.splice(2, 0, ['pedaggi', 'Pedaggi/vignette']);
    const wrap = el('<div style="display:flex;flex-wrap:wrap;gap:6px 20px"></div>');
    for (const [k, lbl] of voci) {
      const c = el(`<label class="chk"><input type="checkbox" ${prev.input.ribalta[k] ? 'checked' : ''}> ${lbl}</label>`);
      c.querySelector('input').addEventListener('change', e => { prev.input.ribalta[k] = e.target.checked; recalc(); });
      wrap.appendChild(c);
    }
    box.appendChild(wrap);
  }

  // ================================================================
  //  RIEPILOGO (colonna destra)
  // ================================================================
  function recalc() {
    const r = calcola(prev.input, imp);
    prev.risultato = r;
    prev.km_totali = prev.input.kmTotali;
    clear(summaryCol);

    const line = (lbl, val, strong) => `<div class="b-row ${strong ? 'strong' : ''}"><span class="lbl">${lbl}</span><span class="money">${fmtEuro(val)}</span></div>`;
    const bd = el(`<div class="tot-box"><div class="card-b breakdown">
      ${line(`Carburante (${fmtNum(r.litri,1)} l)`, r.carburante)}
      ${r.adBlue > 0 ? line(`AdBlue (${fmtNum(r.litriAdBlue,1)} l)`, r.adBlue) : ''}
      ${line('Pasti', r.pasti)}
      ${r.pernottamento > 0 ? line('Pernottamento', r.pernottamento) : ''}
      ${r.pedaggi > 0 ? line('Pedaggi/vignette', r.pedaggi) : ''}
      ${r.medico > 0 ? line('Medico', r.medico) : ''}
      ${r.materiale > 0 ? line('Materiale', r.materiale) : ''}
    </div></div>`);
    summaryCol.appendChild(bd);

    const box = el(`<div class="tot-box">
      <div class="row"><div><div class="k">Spesa reale</div><div class="mini">costo vivo del viaggio</div></div><div class="v money">${fmtEuro(r.spesaReale)}</div></div>
      <div class="row"><div><div class="k">Addebito (km×tariffa)</div><div class="mini">${fmtKm(prev.input.kmTotali)} × ${fmtEuro(prev.input.tariffaKm)} + rimborsi</div></div><div class="v money">${fmtEuro(r.addebitoKm)}</div></div>
      <div class="row addebito"><div><div class="k">Importo da richiedere</div><div class="mini">tariffa + voci ribaltate</div></div><div class="v money">${fmtEuro(r.addebito)}</div></div>
      <div class="row margine"><div><div class="k">Margine</div><div class="mini">${r.margineperc!=null?fmtNum(r.margineperc,0)+'%':''}${r.tariffaEffettiva?` · ${fmtEuro(r.tariffaEffettiva)}/km eff.`:''}</div></div><div class="v money ${r.margine>=0?'pos':'neg'}">${fmtEuro(r.margine)}</div></div>
    </div>`);
    summaryCol.appendChild(box);
  }

  // ================================================================
  //  SALVATAGGIO
  // ================================================================
  async function save() {
    syncItinerario();
    prev.titolo = titoloDaDestinazione();
    prev.risultato = calcola(prev.input, imp);
    prev.km_totali = prev.input.kmTotali;
    prev._prezzoAuto = prezzoAuto;
    prev._pedaggioAuto = pedaggioAuto;
    prev._esteroAuto = esteroAuto;
    const btn = head.querySelector('#btn-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      const saved = await preventivi.save(cleanForSave(prev));
      toast('Preventivo salvato', 'ok');
      prev.id = saved.id;
      ctx.go(`#/preventivo/${saved.id}`);
    } catch (e) {
      toast('Errore nel salvataggio: ' + (e.message || e), 'err');
      console.error(e);
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  // ---------------- helpers locali ----------------
  function card(title, bodyHtml) {
    return el(`<div class="card"><div class="card-h">${esc(title)}</div><div class="card-b">${bodyHtml}</div></div>`);
  }
  function bind(sel, setter, kind) {
    const e = view.querySelector(sel); if (!e) return;
    e.addEventListener('input', () => setter(e.value));
  }
  function bindNum(sel, key) {
    const e = view.querySelector(sel); if (!e) return;
    e.addEventListener('input', () => { prev.input[key] = num(e.value); recalc(); });
  }
  function refillPrezzo() {
    const p = prezzoRiferimento(prev.paese_dest || 'IT', prev.input.alimentazione, tabella(imp));
    if (p != null) {
      prev.input.prezzoCarburante = p;
      const inp = view.querySelector('#prezzoCarb'); if (inp) inp.value = p;
      const badge = view.querySelector('#badge-auto'); if (badge) badge.style.display = '';
    }
  }
  function tariffaEstero() {
    const r = imp.pedaggiEsteroKm != null ? imp.pedaggiEsteroKm : 0.10;
    return Number(r) || 0;
  }
  function refillPedaggio() {
    const rate = tariffaEstero();
    const km = num(prev.input.kmTotali);
    prev.input.pedaggi = Math.round(km * rate);
    const inp = view.querySelector('#pedaggi'); if (inp) inp.value = prev.input.pedaggi || '';
    const badge = view.querySelector('#badge-pedaggio'); if (badge) badge.style.display = '';
    const h = view.querySelector('#pedaggio-hint');
    if (h) h.innerHTML = `≈ ${fmtNum(km, 0)} km × ${fmtEuro(rate)}/km (stima estero). Adegua a mano per vignette o caselli reali.`;
  }
  // Attiva/disattiva la sezione pedaggi in base al viaggio estero.
  function setEstero(on) {
    prev.input.estero = on;
    const cb = view.querySelector('#estero'); if (cb) cb.checked = on;
    const row = view.querySelector('#estero-row'); if (row) row.style.display = on ? '' : 'none';
    if (on) { if (pedaggioAuto) refillPedaggio(); }
    else { prev.input.pedaggi = 0; const p = view.querySelector('#pedaggi'); if (p) p.value = ''; }
    renderRibalta();
  }
  function initEsteroPedaggio() {
    const row = view.querySelector('#estero-row'); if (row) row.style.display = prev.input.estero ? '' : 'none';
    if (!prev.input.estero) return;
    if (pedaggioAuto) { refillPedaggio(); return; }
    const badge = view.querySelector('#badge-pedaggio'); if (badge) badge.style.display = 'none';
    const h = view.querySelector('#pedaggio-hint'); if (h) h.textContent = 'Valore inserito a mano.';
  }
  // Titolo automatico = destinazione finale semplificata (solo al salvataggio).
  function titoloDaDestinazione() {
    const dest = [...prev.tappe].reverse().find(t => t && t.label && String(t.label).trim());
    const citta = dest ? shorten(dest.label).replace(/\s*\(.*\)\s*$/, '').trim() : '';
    return citta ? `Genova → ${citta}` : 'Preventivo trasporto';
  }
  function updateMezzoHint() {
    const m = imp.mezzi.find(x => x.id === prev.input.mezzoId);
    const h = view.querySelector('#mezzo-hint');
    if (m && h) h.textContent = `Consumo di riferimento: ${fmtNum(m.consumo,1)} km/l`;
  }
  function updateCarbHint() {
    const h = view.querySelector('#carb-hint'); if (!h) return;
    const info = paeseDaIso(prev.paese_dest || 'IT', tabella(imp));
    if (info) h.innerHTML = `Media ${esc(info.nome)} (${imp.fuelDataDate}). Modificabile.`;
    else h.textContent = 'Prezzo manuale.';
  }
}

// ================= autocomplete geocoding =================
function attachAutocomplete(input, box, onSelect) {
  let items = [], sel = -1;
  const run = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 3) { hide(); return; }
    box.style.display = 'block'; box.innerHTML = '<div class="empty">Ricerca…</div>';
    try {
      items = await geocode(q, { size: 6 });
      draw();
    } catch (e) {
      box.innerHTML = `<div class="empty">⚠️ ${esc(e.message || 'ricerca non disponibile')}</div>`;
    }
  }, 350);
  function draw() {
    if (!items.length) { box.innerHTML = '<div class="empty">Nessun risultato</div>'; return; }
    box.innerHTML = items.map((it, i) =>
      `<div class="item ${i===sel?'sel':''}" data-i="${i}"><span class="flag">${flag(it.iso2)}</span>${esc(it.label)}</div>`).join('');
    box.querySelectorAll('.item').forEach(d => d.addEventListener('mousedown', ev => {
      ev.preventDefault(); choose(Number(d.dataset.i));
    }));
  }
  function choose(i) { const it = items[i]; if (it) onSelect(it); hide(); }
  function hide() { box.style.display = 'none'; sel = -1; }
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (box.style.display === 'none') return;
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (sel >= 0) { choose(sel); e.preventDefault(); } }
    else if (e.key === 'Escape') hide();
  });
  input.addEventListener('blur', () => setTimeout(hide, 150));
}

// ================= util =================
function emptyTappa() { return { label: '', lon: null, lat: null, iso2: null, iso3: null, paese: null }; }
function tabella(imp) { return imp.prezziCustom || undefined; }
function num(v) { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
function shorten(s) { return String(s).split(',')[0].trim(); }
function cleanForSave(p) {
  const { _prezzoAuto, ...rest } = p;
  return { ...rest, _prezzoAuto };
}
function flag(iso2) {
  if (!iso2 || iso2.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}
