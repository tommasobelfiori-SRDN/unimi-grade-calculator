/*
 * Cloud Function for Firebase — backend del Calcolatore Voto di Laurea UniMi.
 *
 * Custodisce la API key Anthropic (secret ANTHROPIC_API_KEY): i visitatori NON
 * inseriscono alcuna chiave. Riceve i file della carriera (base64) dal frontend,
 * chiama Claude con tool use forzato e restituisce l'elenco esami estratto.
 *
 * Deploy:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY   # incolla la tua sk-ant-...
 *   firebase deploy --only functions,hosting
 *
 * Modello configurabile (default Opus 4.8) via functions/.env → EXTRACT_MODEL=...
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const Anthropic = require("@anthropic-ai/sdk");
const admin = require("firebase-admin");

try {
  admin.initializeApp();
} catch (e) {
  /* già inizializzata */
}

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const EXTRACT_MODEL = defineString("EXTRACT_MODEL", { default: "claude-sonnet-4-6" });
// Verifica App Check: accetta solo richieste dal tuo sito. Default "false" così
// il deploy funziona subito; imposta "true" dopo aver configurato reCAPTCHA.
const ENFORCE_APP_CHECK = defineString("ENFORCE_APP_CHECK", { default: "false" });

// Tetto di spesa mensile (in EUR) su questo endpoint. <= 0 disattiva il limite.
// La spesa è tracciata su Firestore (collezione "usage", doc "YYYY-MM").
const MONTHLY_BUDGET_EUR = defineString("MONTHLY_BUDGET_EUR", { default: "20" });
// Cambio USD→EUR usato per stimare la spesa (i prezzi Anthropic sono in USD).
const USD_PER_EUR = defineString("USD_PER_EUR", { default: "1.08" });

// Prezzi Anthropic in USD per milione di token (input / output).
const PRICES_USD = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

// Stima il costo in EUR di una risposta a partire dal suo usage.
function costEur(usage, model, rate) {
  const u = usage || {};
  const p = PRICES_USD[model] || PRICES_USD["claude-opus-4-8"];
  const usd =
    ((u.input_tokens || 0) * p.in +
      (u.cache_creation_input_tokens || 0) * p.in * 1.25 +
      (u.cache_read_input_tokens || 0) * p.in * 0.1 +
      (u.output_tokens || 0) * p.out) /
    1e6;
  return usd / (rate > 0 ? rate : 1.08);
}

// Limiti anti-abuso (la chiave la paghi tu).
const MAX_FILES = 8;
const MAX_TOTAL_BASE64 = 12_000_000; // ~9 MB di file caricati
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

// Tool use con tool_choice forzato → output strutturato e validato.
const EXTRACTION_TOOL = {
  name: "compila_esami",
  description:
    "Registra l'elenco completo degli esami superati estratti dalla scheda di carriera universitaria.",
  input_schema: {
    type: "object",
    properties: {
      esami: {
        type: "array",
        description: "Tutti gli esami con voto presenti nel documento.",
        items: {
          type: "object",
          properties: {
            nome: { type: "string", description: "Nome dell'insegnamento." },
            voto: {
              type: "string",
              description:
                "Voto: intero 18-30; '30L' per 30 e lode; 'AP' per idoneità o esami senza voto numerico.",
            },
            cfu: { type: "number", description: "Crediti (CFU) dell'esame." },
          },
          required: ["voto", "cfu"],
        },
      },
    },
    required: ["esami"],
  },
};

const PROMPT =
  "Questa è la scheda 'carriera' di uno studente universitario. " +
  "Estrai TUTTI e soli gli esami già superati, con nome, voto e CFU. " +
  'Regole: "30 e lode" → "30L"; idoneità o esami senza voto numerico → "AP". ' +
  "Ignora media, totali, esami non ancora sostenuti e righe che non sono esami. " +
  "Usa lo strumento compila_esami.";

// Handler puro (testabile senza il wrapper onRequest).
async function extractHandler(req, res) {
  {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Metodo non consentito." });
      return;
    }

    // App Check: solo richieste provenienti dal tuo sito (se abilitato).
    if (ENFORCE_APP_CHECK.value() === "true") {
      const token =
        (req.get && req.get("X-Firebase-AppCheck")) ||
        (req.headers && req.headers["x-firebase-appcheck"]);
      if (!token) {
        res.status(401).json({ error: "Richiesta non autorizzata." });
        return;
      }
      try {
        await admin.appCheck().verifyToken(token);
      } catch (e) {
        res.status(401).json({ error: "Richiesta non autorizzata." });
        return;
      }
    }

    try {
      // Tetto di spesa mensile: blocca se già raggiunto.
      const budgetEur = parseFloat(MONTHLY_BUDGET_EUR.value());
      const budgetOn = Number.isFinite(budgetEur) && budgetEur > 0;
      const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
      const usageRef = budgetOn
        ? admin.firestore().collection("usage").doc(monthKey)
        : null;
      if (budgetOn) {
        let spent = 0;
        try {
          const snap = await usageRef.get();
          spent = (snap.exists && snap.data().spentEur) || 0;
        } catch (e) {
          console.error("budget read failed (fail-open):", e);
        }
        if (spent >= budgetEur) {
          res.status(429).json({
            error:
              "Servizio momentaneamente non disponibile (limite di utilizzo raggiunto). Riprova più avanti.",
          });
          return;
        }
      }

      const files = req.body && req.body.files;
      if (!Array.isArray(files) || files.length === 0) {
        res.status(400).json({ error: "Nessun file ricevuto." });
        return;
      }
      if (files.length > MAX_FILES) {
        res.status(400).json({ error: `Massimo ${MAX_FILES} file.` });
        return;
      }

      let total = 0;
      const content = [];
      for (const f of files) {
        if (!f || typeof f.data !== "string" || !ALLOWED_TYPES.has(f.media_type)) {
          res.status(400).json({ error: "File non valido o tipo non supportato." });
          return;
        }
        total += f.data.length;
        if (total > MAX_TOTAL_BASE64) {
          res.status(413).json({ error: "File troppo grandi (max ~9 MB totali)." });
          return;
        }
        if (f.media_type === "application/pdf") {
          content.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: f.data },
          });
        } else {
          content.push({
            type: "image",
            source: { type: "base64", media_type: f.media_type, data: f.data },
          });
        }
      }
      content.push({ type: "text", text: PROMPT });

      const modelUsed = EXTRACT_MODEL.value() || "claude-sonnet-4-6";
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value().trim() });
      const message = await client.messages.create({
        model: modelUsed,
        max_tokens: 8192,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: "compila_esami" },
        messages: [{ role: "user", content }],
      });

      // Aggiorna la spesa mensile stimata (best-effort).
      if (budgetOn) {
        try {
          const eur = costEur(
            message.usage,
            modelUsed,
            parseFloat(USD_PER_EUR.value())
          );
          await usageRef.set(
            {
              spentEur: admin.firestore.FieldValue.increment(eur),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch (e) {
          console.error("budget write failed:", e);
        }
      }

      const toolUse = (message.content || []).find((b) => b.type === "tool_use");
      const esami = toolUse && toolUse.input && toolUse.input.esami;
      res.json({ esami: Array.isArray(esami) ? esami : [] });
    } catch (err) {
      console.error("extract error:", err);
      const status = err && Number.isInteger(err.status) ? err.status : 500;
      res
        .status(status >= 400 && status < 600 ? status : 500)
        .json({ error: "Errore durante l'estrazione. Riprova più tardi." });
    }
  }
}

exports.extract = onRequest(
  {
    region: "europe-west1",
    // Solo i domini del sito (App Check resta la protezione principale).
    cors: [
      "https://uniti-grade-calculator.web.app",
      "https://uniti-grade-calculator.firebaseapp.com",
    ],
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  extractHandler
);

// Esportato per i test unitari (non usato in produzione).
exports.extractHandler = extractHandler;
