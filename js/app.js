import { initStore, auth, impostazioni, MODE } from './data/store.js';
import { el, clear } from './lib/ui.js';
import { renderLogin, renderResetPassword } from './views/auth.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPreventivo } from './views/preventivo.js';
import { renderImpostazioni } from './views/impostazioni.js';

const app = document.getElementById('app');
let currentUser = null;
let imp = null;

const NAV = [
  { id: 'preventivi', icon: '📋', label: 'Preventivi' },
  { id: 'nuovo', icon: '➕', label: 'Nuovo preventivo' },
  { id: 'impostazioni', icon: '⚙️', label: 'Impostazioni' },
];

async function boot() {
  // Il link di recupero password torna con "type=recovery" nell'hash, quello
  // di invito (Supabase Dashboard > Invite user) con "type=invite" (o
  // "type=signup" a seconda della versione): in entrambi i casi l'utente deve
  // impostare la propria password prima di entrare. Rilevo il tipo PRIMA che
  // il client Supabase lo consumi e pulisca l'URL.
  const match = location.hash.match(/type=(recovery|invite|signup)/);
  const isInvite = match && match[1] !== 'recovery';
  const isSetPassword = !!match;
  await initStore();
  currentUser = await auth.current();
  if (isSetPassword) {
    renderResetPassword(app, async () => { currentUser = await auth.current(); await startApp(); }, { invite: isInvite });
    return;
  }
  if (!currentUser) {
    renderLogin(app, async () => { currentUser = await auth.current(); await startApp(); });
    return;
  }
  await startApp();
}

let _routerBound = false;
async function startApp() {
  imp = await impostazioni.get();
  renderShell();
  if (!_routerBound) { window.addEventListener('hashchange', route); _routerBound = true; }
  // Se l'hash è vuoto lo impostiamo: questo scatena hashchange -> route().
  // Se è già valorizzato, hashchange non parte e chiamiamo route() noi.
  if (!location.hash) location.hash = '#/preventivi';
  else route();
}

function renderShell() {
  clear(app);
  const layout = el(`<div class="layout">
    <aside class="sidebar">
      <div class="brand"><div class="logo">✚</div><div><b>Preventivi Trasporti</b><span>Croce Rossa Italiana</span></div></div>
      <nav class="nav"></nav>
      <div class="foot">
        <div class="who">${currentUser.nome || currentUser.email}</div>
        <div>${currentUser.ruolo || ''} · ${MODE === 'local' ? 'modalità locale' : 'cloud'}</div>
        <button data-logout>Esci</button>
      </div>
    </aside>
    <main class="main" id="view"></main>
  </div>`);
  const nav = layout.querySelector('.nav');
  for (const n of NAV) {
    nav.appendChild(el(`<a href="#/${n.id}" data-nav="${n.id}"><span class="ic">${n.icon}</span><span class="txt">${n.label}</span></a>`));
  }
  layout.querySelector('[data-logout]').addEventListener('click', async () => { await auth.signOut(); location.hash = ''; location.reload(); });
  app.appendChild(layout);
}

function setActive(id) {
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === id));
}

let _routeSeq = 0;
async function route() {
  const view = document.getElementById('view');
  if (!view) return;
  const my = ++_routeSeq;
  const hash = location.hash.replace(/^#\//, '') || 'preventivi';
  const [section, param] = hash.split('/');
  setActive(section === 'preventivo' ? 'preventivi' : section);
  clear(view);
  view.appendChild(el('<div class="spinner" style="margin-top:60px"></div>'));
  const ctx = {
    user: currentUser,
    imp,
    go: (h) => { location.hash = h; },
    reloadImp: async () => { imp = await impostazioni.get(); ctx.imp = imp; },
  };
  try {
    if (my !== _routeSeq) return;
    clear(view);
    if (section === 'preventivi') await renderDashboard(view, ctx);
    else if (section === 'nuovo') await renderPreventivo(view, null, ctx);
    else if (section === 'preventivo' && param) await renderPreventivo(view, param, ctx);
    else if (section === 'impostazioni') await renderImpostazioni(view, ctx);
    else await renderDashboard(view, ctx);
  } catch (e) {
    clear(view);
    view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${e.message}</p></div>`));
    console.error(e);
  }
}

boot();
