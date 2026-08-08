import { impostazioni } from '../data/store.js';
import { DEFAULT_IMPOSTAZIONI } from '../calc.js';
import { FUEL_PRICES, FUEL_DATA_DATE } from '../data/fuel-prices.js';
import { el, clear, esc, toast, fmtNum, confirmDialog } from '../lib/ui.js';

export async function renderImpostazioni(view, ctx) {
  clear(view);
  const imp = structuredClone(ctx.imp);
  const prezzi = structuredClone(imp.prezziCustom || FUEL_PRICES);

  view.appendChild(el(`<div class="page-head">
    <div><h1>Impostazioni</h1><p>Parametri di calcolo, parco mezzi e prezzi carburante di riferimento</p></div>
    <button class="btn primary" id="save">💾 Salva impostazioni</button>
  </div>`));

  // ---------- Parco mezzi ----------
  const cMezzi = card('Parco mezzi e consumi', '<div id="mezzi"></div><button class="btn sm" id="add-mezzo" type="button">➕ Aggiungi mezzo</button>');
  view.appendChild(cMezzi);
  const mezziBox = cMezzi.querySelector('#mezzi');
  const COLS = 'grid-template-columns:1fr 130px 90px 34px';
  function drawMezzi() {
    clear(mezziBox);
    mezziBox.appendChild(el(`<div class="matrow" style="${COLS};font-size:12px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.03em">
      <div>Nome</div><div>Alimentazione</div><div>km/l</div><div></div></div>`));
    imp.mezzi.forEach((m, i) => {
      const r = el(`<div class="matrow" style="${COLS}">
        <input type="text" value="${esc(m.nome)}">
        <select><option value="diesel" ${m.alimentazione==='diesel'?'selected':''}>Gasolio</option><option value="benzina" ${m.alimentazione==='benzina'?'selected':''}>Benzina</option></select>
        <input type="number" step="0.1" value="${m.consumo}">
        <button class="rm btn ghost sm" type="button">✕</button>
      </div>`);
      const [nome, cons] = r.querySelectorAll('input');
      const alim = r.querySelector('select');
      nome.addEventListener('input', () => m.nome = nome.value);
      alim.addEventListener('change', () => m.alimentazione = alim.value);
      cons.addEventListener('input', () => m.consumo = Number(cons.value) || 0);
      r.querySelector('.rm').addEventListener('click', () => {
        if (imp.mezzi.length <= 1) { toast('Serve almeno un mezzo', 'err'); return; }
        imp.mezzi.splice(i, 1); drawMezzi();
      });
      mezziBox.appendChild(r);
    });
  }
  drawMezzi();
  cMezzi.querySelector('#add-mezzo').addEventListener('click', () => {
    imp.mezzi.push({ id: 'm' + Date.now(), nome: 'Nuovo mezzo', alimentazione: 'diesel', consumo: 10 }); drawMezzi();
  });

  // ---------- Parametri economici ----------
  const cPar = card('Parametri economici', `
    <div class="form-row three">
      <div class="field"><label>Costo a pasto (€)</label><input type="number" step="0.5" id="pastoCosto" value="${imp.pastoCosto}"></div>
      <div class="field"><label>Tariffa € / km (default)</label><input type="number" step="0.05" id="tariffaKm" value="${imp.tariffaKm}"></div>
      <div class="field"><label>&nbsp;</label><div class="hint">La tariffa resta modificabile in ogni singolo preventivo.</div></div>
    </div>
    <div class="form-row three">
      <div class="field"><label>AdBlue: % del gasolio</label><input type="number" step="0.5" id="adBluePerc" value="${imp.adBluePerc}"></div>
      <div class="field"><label>AdBlue: €/l</label><input type="number" step="0.01" id="adBluePrezzo" value="${imp.adBluePrezzo}"></div>
      <div class="field"><label>Pedaggi estero (€/km)</label><input type="number" step="0.01" id="pedaggiEsteroKm" value="${imp.pedaggiEsteroKm}">
        <div class="hint">In Italia la CRI è esente: i pedaggi si applicano solo ai viaggi all'estero.</div></div>
    </div>
    <div class="form-row three">
      <div class="field"><label>Medico: tariffa oraria (€/h)</label><input type="number" step="0.5" id="medicoTariffaOraria" value="${imp.medicoTariffaOraria}">
        <div class="hint">Default usato nel preventivo: totale = ore stimate × tariffa, sempre modificabile.</div></div>
      <div class="field"><label>Infermiere: tariffa oraria (€/h)</label><input type="number" step="0.5" id="infermiereTariffaOraria" value="${imp.infermiereTariffaOraria}">
        <div class="hint">Stesso principio del medico: totale = ore stimate × tariffa, sempre modificabile.</div></div>
    </div>
    <label class="section-t" style="margin-top:4px">Voci ribaltate sull'addebito (default)</label>
    <div id="ribalta" style="display:flex;flex-wrap:wrap;gap:6px 20px"></div>`);
  view.appendChild(cPar);
  const ribBox = cPar.querySelector('#ribalta');
  const voci = [['pasti','Pasti'],['pernottamento','Pernottamento'],['pedaggi','Pedaggi/vignette (estero)'],['sanitari','Sanitari (medico/infermiere)'],['materiale','Materiale']];
  for (const [k, lbl] of voci) {
    const c = el(`<label class="chk"><input type="checkbox" ${imp.ribalta[k]?'checked':''}> ${lbl}</label>`);
    c.querySelector('input').addEventListener('change', e => imp.ribalta[k] = e.target.checked);
    ribBox.appendChild(c);
  }
  cPar.querySelector('#pastoCosto').addEventListener('input', e => imp.pastoCosto = Number(e.target.value) || 0);
  cPar.querySelector('#tariffaKm').addEventListener('input', e => imp.tariffaKm = Number(e.target.value) || 0);
  cPar.querySelector('#adBluePerc').addEventListener('input', e => imp.adBluePerc = Number(e.target.value) || 0);
  cPar.querySelector('#adBluePrezzo').addEventListener('input', e => imp.adBluePrezzo = Number(e.target.value) || 0);
  cPar.querySelector('#pedaggiEsteroKm').addEventListener('input', e => imp.pedaggiEsteroKm = Number(e.target.value) || 0);
  cPar.querySelector('#medicoTariffaOraria').addEventListener('input', e => imp.medicoTariffaOraria = Number(e.target.value) || 0);
  cPar.querySelector('#infermiereTariffaOraria').addEventListener('input', e => imp.infermiereTariffaOraria = Number(e.target.value) || 0);

  // ---------- Prezzi carburante ----------
  const cFuel = card(`Prezzi carburante di riferimento`, `
    <div class="banner info" style="margin:0 0 14px"><div class="bi">⛽</div><div>
      <b>Medie nazionali · aggiornate al ${esc(imp.fuelDataDate || FUEL_DATA_DATE)}</b>
      <div class="small">Valori usati per precompilare il prezzo in base al Paese di destinazione. Modificali quando vuoi; premi "Ripristina" per tornare ai valori ufficiali di riferimento.</div>
    </div></div>
    <div class="toolbar"><div class="search"><input type="text" id="qfuel" placeholder="Filtra Paese…"></div>
      <button class="btn sm" id="reset-fuel" type="button">↺ Ripristina valori ufficiali</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Paese</th><th>Gasolio €/l</th><th>Benzina €/l</th></tr></thead><tbody id="fuel-body"></tbody></table></div>`);
  view.appendChild(cFuel);
  const fuelBody = cFuel.querySelector('#fuel-body');
  function drawFuel() {
    const q = cFuel.querySelector('#qfuel').value.toLowerCase().trim();
    clear(fuelBody);
    Object.entries(prezzi).sort((a,b) => a[1].nome.localeCompare(b[1].nome)).forEach(([iso, row]) => {
      if (q && !row.nome.toLowerCase().includes(q)) return;
      const tr = el(`<tr>
        <td>${flag(iso)} ${esc(row.nome)} <span class="mini">${iso}</span></td>
        <td><input type="number" step="0.001" value="${row.diesel}" style="width:110px;padding:6px 8px"></td>
        <td><input type="number" step="0.001" value="${row.benzina}" style="width:110px;padding:6px 8px"></td>
      </tr>`);
      const [d, b] = tr.querySelectorAll('input');
      d.addEventListener('input', () => row.diesel = Number(d.value) || 0);
      b.addEventListener('input', () => row.benzina = Number(b.value) || 0);
      fuelBody.appendChild(tr);
    });
  }
  drawFuel();
  cFuel.querySelector('#qfuel').addEventListener('input', drawFuel);
  cFuel.querySelector('#reset-fuel').addEventListener('click', async () => {
    if (await confirmDialog('Ripristinare tutti i prezzi ai valori ufficiali di riferimento?')) {
      Object.assign(prezzi, structuredClone(FUEL_PRICES));
      imp.fuelDataDate = FUEL_DATA_DATE;
      drawFuel(); toast('Prezzi ripristinati', 'ok');
    }
  });

  // ---------- salvataggio ----------
  view.querySelector('#save').addEventListener('click', async () => {
    const btn = view.querySelector('#save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      imp.prezziCustom = prezzi;
      await impostazioni.save(imp);
      await ctx.reloadImp();
      toast('Impostazioni salvate', 'ok');
    } catch (e) {
      toast('Errore: ' + (e.message || e), 'err'); console.error(e);
    } finally { btn.disabled = false; btn.innerHTML = old; }
  });

  function card(title, bodyHtml) {
    return el(`<div class="card" style="margin-bottom:18px"><div class="card-h">${esc(title)}</div><div class="card-b">${bodyHtml}</div></div>`);
  }
}

function flag(iso2) {
  if (!iso2 || iso2.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}
