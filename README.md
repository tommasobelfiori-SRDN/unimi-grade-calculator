# Calcolatore Voto di Laurea — UniMi

Calcolatore del voto di laurea (valido per tutte le facoltà UniMi) in React + Vite,
con **import automatico della carriera** da PDF o screenshot: i file vengono letti
da Claude (Anthropic) e gli esami compilati in automatico.

La API key è **tua e sta nel backend**: i visitatori non inseriscono nulla.

## Struttura

```
src/CalcolatoreVotoLaurea.jsx   # il calcolatore (componente unico, stili inline)
src/main.jsx, index.html        # bootstrap Vite
functions/index.js              # Cloud Function "extract": custodisce la key, chiama Claude
firebase.json                   # Hosting (dist) + rewrite /api/extract → function
.firebaserc                     # ← metti qui il tuo PROJECT ID
```

Il frontend chiama `POST /api/extract` con i file in base64; il rewrite di Firebase
Hosting instrada alla Cloud Function, che chiama Claude con *tool use* forzato e
restituisce `{ esami: [...] }`. La chiave non transita mai dal browser.

## Sviluppo locale

```bash
npm install
npm run dev          # solo frontend (l'import richiede il backend)
```

Per provare l'import end-to-end in locale serve l'emulatore Firebase:

```bash
cd functions && npm install && cd ..
npm run build                              # genera dist/
firebase emulators:start --only functions,hosting
# apri http://127.0.0.1:5000
```

Per puntare il `npm run dev` (porta 5180) all'emulatore Hosting (porta 5000),
crea un file `.env.local` nella root con:

```
VITE_API_BASE=http://127.0.0.1:5000
```

## Deploy

```bash
# 1) imposta il tuo project id in .firebaserc (al posto di IL-TUO-PROJECT-ID)
# 2) salva la API key come secret (NON in chiaro nel codice)
firebase functions:secrets:set ANTHROPIC_API_KEY      # incolla la tua sk-ant-...
# 3) build + deploy
npm run build
firebase deploy --only functions,hosting
```

### Cambiare modello (controllo costi)

Il default è `claude-sonnet-4-6` (buon rapporto qualità/costo). Per cambiarlo, crea
`functions/.env` con:

```
EXTRACT_MODEL=claude-opus-4-8     # più accurato (più costoso)
# oppure: EXTRACT_MODEL=claude-haiku-4-5   # più economico
```

e ri-deploya le functions.

## Protezione con App Check (consigliata)

App Check fa sì che `/api/extract` accetti **solo** richieste dal tuo sito (token
reCAPTCHA v3 verificato lato server). È già integrato: graceful sul frontend
(se non configurato non blocca nulla) e attivabile sul backend con un flag.

Per attivarlo:

1. **Firebase Console → App Check**: registra l'app web col provider **reCAPTCHA v3**
   (genera/incolla la *site key* e la *secret key* di reCAPTCHA v3).
2. **Frontend** — crea `.env.production` (vedi `.env.example`) con la config web del
   progetto e la site key, poi ricostruisci:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_RECAPTCHA_SITE_KEY=...
   ```
3. **Backend** — in `functions/.env` imposta `ENFORCE_APP_CHECK=true`.
4. Ridistribuisci: `npm run build && firebase deploy --only functions,hosting`.

> Tieni `ENFORCE_APP_CHECK=false` finché il passo 1 non è completo, altrimenti la
> function risponde `401` a tutte le richieste.

## Tetto di spesa (€20/mese)

La function tiene il conto della spesa mensile stimata su questo endpoint e, una
volta raggiunto il tetto, **smette di chiamare Claude** e risponde `429` (il sito
mostra un messaggio di "servizio non disponibile"). Configurazione in `functions/.env`:

```
MONTHLY_BUDGET_EUR=20    # 0 = nessun limite
USD_PER_EUR=1.08         # i prezzi Anthropic sono in USD
```

Richiede **Firestore attivo** (modalità Native): la spesa è salvata nella collezione
`usage`, documento `YYYY-MM`. Abilitalo dalla Firebase Console → Firestore Database →
"Crea database". Se Firestore non risponde, la function non blocca le richieste
(fail-open): il limite "vero" resta quello in Console (sotto).

> Nota: è una stima dal numero di token usati, non la cifra fatturata esatta, e copre
> solo le chiamate fatte da questo endpoint.

### Limite autorevole sulla Console Anthropic (consigliato)

Il tetto sopra è applicativo; il limite di spesa "duro" si imposta nella tua Console:

1. [console.anthropic.com](https://console.anthropic.com) → **Billing / Limits**
   (Limiti di utilizzo).
2. Imposta un **monthly spend limit** (es. ~$22 ≈ €20).

Questo blocca la spesa a prescindere da come viene usata la chiave. Aggiungi anche un
**budget alert** su Google Cloud per il progetto Firebase, se vuoi le notifiche.

## Altre note

La function limita già le richieste (max 8 file, ~9 MB totali, solo PDF/immagini) e
decide il modello lato server. Con App Check attivo (sopra) eviti chiamate da fuori
dal tuo sito.
