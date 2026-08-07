// ============================================================
//  Server statico per lo sviluppo locale + proxy /api
//  Avvio:  node server.js      (poi apri http://localhost:4322)
//
//  Per far funzionare mappa/percorsi anche in locale, imposta la chiave:
//    Windows PowerShell:  $env:ORS_KEY="la-tua-chiave"; node server.js
//    macOS/Linux:         ORS_KEY=la-tua-chiave node server.js
//  Puoi anche creare un file .dev.vars con:  ORS_KEY=la-tua-chiave
//  Senza chiave l'app funziona lo stesso: inserisci i km a mano.
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 4322;

// carica ORS_KEY da .dev.vars se non già in ambiente
if (!process.env.ORS_KEY) {
  try {
    const dv = fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8');
    const m = dv.match(/ORS_KEY\s*=\s*(.+)/);
    if (m) process.env.ORS_KEY = m[1].trim();
  } catch {}
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  // ---- proxy API (replica le Pages Functions) ----
  if (u.pathname === '/api/geocode') return apiGeocode(u, res);
  if (u.pathname === '/api/route') return apiRoute(req, res);

  // ---- file statici ----
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
server.listen(PORT, () => console.log(`Server attivo su http://localhost:${PORT}  (ORS_KEY ${process.env.ORS_KEY ? 'presente' : 'ASSENTE — km manuali'})`));

function sendJson(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function apiGeocode(u, res) {
  const text = u.searchParams.get('text') || '';
  const size = u.searchParams.get('size') || '6';
  if (!text || text.length < 2) return sendJson(res, { features: [] });
  if (!process.env.ORS_KEY) return sendJson(res, { error: 'Chiave OpenRouteService non configurata (ORS_KEY).' }, 500);
  const api = new URL('https://api.openrouteservice.org/geocode/search');
  api.searchParams.set('api_key', process.env.ORS_KEY);
  api.searchParams.set('text', text);
  api.searchParams.set('size', size);
  try {
    const r = await fetch(api.toString(), { headers: { Accept: 'application/json' } });
    if (!r.ok) return sendJson(res, { error: `Geocoding non riuscito (${r.status}).` }, r.status);
    return sendJson(res, await r.json());
  } catch { return sendJson(res, { error: 'OpenRouteService non raggiungibile.' }, 502); }
}

function apiRoute(req, res) {
  let raw = '';
  req.on('data', c => raw += c);
  req.on('end', async () => {
    if (!process.env.ORS_KEY) return sendJson(res, { error: 'Chiave OpenRouteService non configurata (ORS_KEY).' }, 500);
    let body; try { body = JSON.parse(raw); } catch { return sendJson(res, { error: 'Body non valido.' }, 400); }
    if (!Array.isArray(body.coordinates) || body.coordinates.length < 2) return sendJson(res, { error: 'Servono almeno due coordinate.' }, 400);
    const payload = { coordinates: body.coordinates };
    if (body.avoidTolls) payload.options = { avoid_features: ['tollways'] };
    try {
      const r = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: { Authorization: process.env.ORS_KEY, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { let m = `Percorso non riuscito (${r.status}).`; try { const e = await r.json(); m = e?.error?.message || m; } catch {} return sendJson(res, { error: m }, r.status); }
      return sendJson(res, await r.json());
    } catch { return sendJson(res, { error: 'OpenRouteService non raggiungibile.' }, 502); }
  });
}
