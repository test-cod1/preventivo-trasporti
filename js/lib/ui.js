// ---------- DOM ----------
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// ---------- Formatting ----------
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function fmtEuro(nv, dash = '—') {
  if (nv === null || nv === undefined || nv === '' || (typeof nv === 'number' && !Number.isFinite(nv))) return dash;
  return Number(nv).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
export function fmtNum(nv, dec = 0) {
  if (nv === null || nv === undefined || nv === '' || !Number.isFinite(Number(nv))) return '—';
  return Number(nv).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function fmtKm(nv) {
  if (nv === null || nv === undefined || nv === '') return '—';
  return fmtNum(nv, 0) + ' km';
}
export function todayISO() { return new Date().toISOString().slice(0, 10); }

// ---------- Toast ----------
let toastT;
export function toast(msg, kind = '') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = el(`<div class="toast ${kind}">${esc(msg)}</div>`);
  document.body.appendChild(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 3000);
}

// ---------- Modal ----------
export function openModal({ title, body, footer, wide }) {
  const back = el(`<div class="modal-back"></div>`);
  const modal = el(`<div class="modal" ${wide ? 'style="max-width:860px"' : ''}>
    <div class="m-h"><h3>${esc(title)}</h3><button class="btn ghost sm" data-x>✕</button></div>
    <div class="m-b"></div>
    <div class="m-f"></div>
  </div>`);
  modal.querySelector('.m-b').append(body);
  if (footer) modal.querySelector('.m-f').append(footer); else modal.querySelector('.m-f').remove();
  back.appendChild(modal);
  const close = () => back.remove();
  back.addEventListener('click', e => { if (e.target === back) close(); });
  modal.querySelector('[data-x]').addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  document.body.appendChild(back);
  return { close, modal, back };
}

// ---------- confirm ----------
export function confirmDialog(msg, { danger, okLabel } = {}) {
  return new Promise(res => {
    const body = el(`<p style="margin:0">${esc(msg)}</p>`);
    const foot = el(`<div style="display:flex;gap:10px">
      <button class="btn" data-no>Annulla</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel || 'Conferma')}</button></div>`);
    const { close } = openModal({ title: 'Conferma', body, footer: foot });
    foot.querySelector('[data-no]').onclick = () => { close(); res(false); };
    foot.querySelector('[data-yes]').onclick = () => { close(); res(true); };
  });
}

// ---------- debounce ----------
export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
