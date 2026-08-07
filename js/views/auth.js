import { auth, MODE } from '../data/store.js';
import { el, clear } from '../lib/ui.js';

export function renderLogin(app, onDone) {
  clear(app);
  const demo = MODE === 'local';
  const wrap = el(`<div class="login-wrap"><div class="login">
    <div class="brand"><div class="logo">✚</div><div><b>Preventivi Trasporti</b><span>Croce Rossa Italiana — Genova</span></div></div>
    ${demo ? `<div class="banner ok" style="margin-bottom:18px"><div class="bi">💡</div><div><b>Modalità locale (demo)</b><div class="small">I dati restano su questo dispositivo. Entra con un nome qualsiasi o usa l'accesso rapido.</div></div></div>` : ''}
    <div class="field"><label>Email</label><input type="text" id="email" placeholder="nome@cri.it" autocomplete="username"></div>
    <div class="field"><label>Password</label><input type="password" id="pw" placeholder="••••••••" autocomplete="current-password"></div>
    <button class="btn primary" id="go" style="width:100%;justify-content:center;margin-top:6px">Accedi</button>
    ${demo ? `<button class="btn" id="quick" style="width:100%;justify-content:center;margin-top:10px">Accesso rapido demo</button>` : ''}
    <div id="err" style="color:var(--danger);font-size:13px;margin-top:12px;text-align:center"></div>
  </div></div>`);
  app.appendChild(wrap);

  const err = wrap.querySelector('#err');
  async function doLogin(email, pw) {
    err.textContent = '';
    try { await auth.signIn(email, pw); onDone(); }
    catch (e) { err.textContent = e.message || 'Accesso non riuscito'; }
  }
  wrap.querySelector('#go').addEventListener('click', () =>
    doLogin(wrap.querySelector('#email').value.trim(), wrap.querySelector('#pw').value));
  wrap.querySelector('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') wrap.querySelector('#go').click(); });
  if (demo) wrap.querySelector('#quick').addEventListener('click', () => doLogin('demo@cri.it', 'demo'));
}
