# Preventivi Trasporti Sanitari — CRI Genova

Gestionale web per calcolare **preventivi di trasporti sanitari fuori Genova**.
Ricalca e amplia la logica dello storico foglio Excel "conto trasferte":

- **Itinerario con tappe**: partenza sempre da *Corso Aldo Gastaldi 11, Genova*, poi
  destinazioni con ricerca indirizzo; **km e durata calcolati automaticamente**
  (andata e ritorno o sola andata, con opzione "evita pedaggi").
- **Prezzo carburante automatico** in base al **Paese di destinazione** (medie
  nazionali europee precaricate al 3/8/2026), sempre modificabile a mano.
- **Doppio totale affiancato**: *spesa reale* (costo vivo) e *addebito* (km × tariffa
  + voci a rimborso), con **margine** in evidenza.
- Voci complete: carburante, pasti, pernottamento, sanitari (medico/infermiere),
  pedaggi/vignette estero (attivi automaticamente solo per destinazioni fuori Italia),
  materiale di consumo (ossigeno, orinale, DPI…).
- **Storico preventivi** con stati (bozza / inviato / confermato / annullato),
  ricerca e **stampa/PDF** del preventivo.
- Parametri tutti configurabili (consumi mezzi, €/pasto, tariffa €/km, prezzi carburante).

Stack: HTML/JS vanilla (nessun build) · Supabase (login + dati) · Cloudflare Pages
+ Pages Functions (proxy mappe) · OpenRouteService (geocoding + percorsi).

---

## ⚙️ Cosa devi fare tu (una sola volta)

Tre passaggi. Il resto è già pronto.

### 1. Chiave OpenRouteService (mappe/percorsi) — gratuita, ~2 minuti
1. Vai su **https://openrouteservice.org/dev/#/signup** e registrati.
2. Crea un token gratuito ("Request a token" → tipo *Standard*).
3. Copia la chiave: ti serve al passo 3.

### 2. Database Supabase
Apri il tuo progetto Supabase → **SQL Editor → New query**, incolla il contenuto di
[`supabase/schema.sql`](supabase/schema.sql) ed esegui.
> Puoi usare **lo stesso progetto** di *gestione-mezzi-cri*: le tabelle hanno nomi
> dedicati (`preventivi`, `impostazioni_trasferte`) e non c'è conflitto. In quel caso
> `js/config.js` è già configurato con le credenziali giuste. Se usi un progetto
> diverso, aggiorna `url` e `anonKey` in `js/config.js`.

Se non sei ancora admin, esegui anche:
```sql
update public.profili set ruolo='admin' where email='tua@email';
```

### 3. Deploy su Cloudflare Pages
1. Crea il repository e collega la cartella a Cloudflare Pages (come per gli altri
   progetti: **solo git push**, niente build command — è un sito statico).
2. Nel progetto Pages → **Settings → Environment variables** aggiungi:
   - **Nome:** `ORS_KEY`  **Valore:** la chiave OpenRouteService del passo 1.
3. `git push` → online.

Fatto. 🎉

---

## 🧪 Provare in locale

```bash
node server.js
```
Poi apri http://localhost:4322.

- Per far funzionare mappa e percorsi anche in locale, imposta la chiave prima di avviare:
  - PowerShell: `$env:ORS_KEY="la-tua-chiave"; node server.js`
  - oppure crea un file `.dev.vars` con `ORS_KEY=la-tua-chiave`
- Senza chiave l'app funziona comunque: inserisci i **km a mano**.
- Per provare **senza account/database**, apri con `?mode=local` (dati solo sul browser):
  http://localhost:4322/?mode=local

---

## 🗂️ Struttura

```
index.html            avvio
server.js             server statico + proxy /api per lo sviluppo locale
css/styles.css        interfaccia (design CRI)
js/
  config.js           credenziali Supabase, sede di partenza, endpoint API
  calc.js             motore di calcolo (spesa reale + addebito + margine)
  app.js              router e shell
  data/
    store.js          auth + preventivi + impostazioni (Supabase o locale)
    fuel-prices.js    prezzi carburante europei di riferimento
  lib/                supabase, routing (ORS), pdf, ui
  views/              auth, dashboard (elenco), preventivo (editor), impostazioni
functions/api/
  geocode.js          proxy geocoding OpenRouteService (usa ORS_KEY)
  route.js            proxy calcolo percorso OpenRouteService (usa ORS_KEY)
supabase/schema.sql   tabelle + RLS
```

## Note
- **OpenRouteService** (piano gratuito) copre ampiamente l'uso normale (2000
  richieste/giorno). La chiave resta lato server (Pages Functions): non è mai esposta.
- I **prezzi carburante** sono medie nazionali di riferimento (non "al distributore
  al secondo"): per un preventivo sono più che sufficienti e sono sempre correggibili.
  Aggiornali quando vuoi da **Impostazioni**.
- I pedaggi non sono forniti da OpenRouteService: si inseriscono a mano (campo dedicato).
