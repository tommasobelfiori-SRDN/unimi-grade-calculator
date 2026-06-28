import React, { useState, useMemo, useEffect } from "react";
import { getAppCheckToken } from "./appCheck";

/*
 * Calcolatore Voto di Laurea — Università degli Studi di Milano (UniMi)
 * Valido per tutte le facoltà. Supporta tema chiaro/scuro e lingua IT/EN.
 *
 * Formula:
 *   Punteggio base = [Σ(voto × CFU) / Σ(CFU)] × (110 / 30)
 *   Voto finale    = Math.round(base + bonus sessione + altri bonus + punti tesi)
 *   Lode           = se voto finale > 110 (richiede voto unanime della commissione)
 *
 * Regole:
 *   - 30 e Lode vale 33 in tutti i calcoli
 *   - Gli esami AP / Idoneità sono esclusi dalla media ponderata
 *   - Arrotondamento standard: Math.round()
 */

const ACCENT = "#4338ca";
const GREEN = "#16a34a";

// ---------------------------------------------------------------------------
// Palette grado (numero grande + celle scenario), variante chiara e scura
// ---------------------------------------------------------------------------
function gradeColor(g, dark) {
  if (dark) {
    if (g >= 103) return "#34d399";
    if (g >= 98) return "#60a5fa";
    if (g >= 93) return "#a78bfa";
    return "#fbbf24";
  }
  if (g >= 103) return "#059669"; // verde
  if (g >= 98) return "#2563eb"; // blu
  if (g >= 93) return "#7c3aed"; // viola
  return "#d97706"; // ambra
}
function cellBg(g, dark) {
  if (dark) {
    if (g >= 103) return "#0f3d2a";
    if (g >= 98) return "#102a4d";
    if (g >= 93) return "#281c4d";
    return "#3d2f0a";
  }
  if (g >= 103) return "#bbf7d0";
  if (g >= 98) return "#bfdbfe";
  if (g >= 93) return "#e9d5ff";
  return "#fef9c3";
}

// ---------------------------------------------------------------------------
// Temi
// ---------------------------------------------------------------------------
const THEMES = {
  light: {
    pageBg: "#f3f0ff",
    card: "#ffffff",
    shadow: "0 1px 10px rgba(0,0,0,0.06)",
    text: "#1f2937",
    heading: "#1e1b4b",
    muted: "#6b7280",
    faint: "#9ca3af",
    inputBg: "#ffffff",
    border: "#d1d5db",
    divider: "#eeeeee",
    divider2: "#e5e7eb",
    panel: "#f9fafb",
    cellEmpty: "#f3f4f6",
    ghostBg: "#ffffff",
    ghostText: "#374151",
    accentText: "#4338ca",
    greenText: "#16a34a",
    okBg: "#dcfce7",
    okBorder: "#86efac",
    okText: "#15803d",
    errBg: "#fee2e2",
    errBorder: "#fca5a5",
    errText: "#b91c1c",
  },
  dark: {
    pageBg: "#13111f",
    card: "#1f1d2e",
    shadow: "0 1px 14px rgba(0,0,0,0.5)",
    text: "#e7e6f0",
    heading: "#f0eeff",
    muted: "#a6a3b8",
    faint: "#7d7a92",
    inputBg: "#2a2740",
    border: "#403c5c",
    divider: "#2e2b40",
    divider2: "#332f48",
    panel: "#181626",
    cellEmpty: "#2a2740",
    ghostBg: "#2a2740",
    ghostText: "#cdcbe0",
    accentText: "#a39bf5",
    greenText: "#34d399",
    okBg: "#0f2e1d",
    okBorder: "#1f5135",
    okText: "#4ade80",
    errBg: "#3a1a1a",
    errBorder: "#5e2626",
    errText: "#f87171",
  },
};

// ---------------------------------------------------------------------------
// Traduzioni
// ---------------------------------------------------------------------------
const TRANSLATIONS = {
  it: {
    title: "Calcolatore Voto di Laurea",
    subtitle: "Università degli Studi di Milano · valido per tutte le facoltà",
    tagline: "Fatto da uno studente UniMi, per gli studenti UniMi",
    themeDark: "Scuro",
    themeLight: "Chiaro",
    importTitle: "Importa la tua carriera (PDF o screenshot)",
    importDesc:
      "Carica la scheda “carriera” (da SIFA / UNIMIA): l'intelligenza artificiale legge il documento e compila automaticamente la tabella degli esami, così non devi inserirli a mano uno a uno.",
    fileLabel: "File (PDF o immagini, anche più di uno)",
    filesSelected: (n) => `${n} file selezionati`,
    extract: "Estrai esami",
    extracting: "Estrazione in corso…",
    privacyNote:
      "I file vengono inviati al nostro server, che li elabora con l'intelligenza artificiale e li scarta subito dopo: nessun dato viene salvato. Controlla sempre gli esami importati prima di affidarti al calcolo.",
    errNoFiles: "Carica almeno un PDF o uno screenshot della carriera.",
    errBadFormat: "Formato file non supportato: usa PDF o immagini.",
    errTooLarge:
      "File troppo grandi (max ~9 MB totali). Carica meno pagine o riduci la risoluzione.",
    errNoExams: "Nessun esame riconosciuto nel documento.",
    errNoValid: "Nessun esame valido estratto.",
    imported: (n) => `Importati ${n} esami. Controlla e correggi eventuali errori.`,
    examsTitle: "Esami sostenuti",
    colName: "Nome esame",
    colGrade: "Voto",
    colCfu: "CFU",
    optional: "(facoltativo)",
    addExam: "+ Aggiungi esame",
    totExams: "Esami (no AP)",
    totCfu: "CFU totali",
    totAvg: "Media ponderata",
    totBase: "Punteggio base",
    resultTitle: "Voto finale",
    enterExams: "Inserisci gli esami",
    honorsLine: "e Lode 🎓",
    honors110: "110 e Lode",
    brkSession: "+ Sessione",
    brkErasmus: "+ Erasmus / Mobilità",
    brkLaureando: "+ Laureando in corso",
    brkExtra: "+ Bonus aggiuntivo",
    brkThesis: "+ Elaborato finale",
    brkRaw: "Lordo",
    badgeOk: "✓ Lode raggiungibile",
    badgeNo: "✗ Lode non raggiungibile",
    maxTheoretical: "max teorico",
    honorsNote: "La lode è assegnata con voto unanime della commissione.",
    bonusTitle: "Bonus",
    sessionLabel: "Sessione di laurea",
    sessions: {
      nessuna: "Nessuna",
      straordinaria: "Straordinaria",
      invernale: "Invernale",
      primaverile: "Primaverile",
      estiva: "Estiva",
      autunnale: "Autunnale",
    },
    erasmusLabel: "Erasmus / Mobilità internazionale",
    laureandoLabel: "Laureando in corso (nei tempi previsti)",
    extraBonusLabel: "Bonus aggiuntivo (specifico per facoltà)",
    pt: "pt",
    thesisTitle: "Elaborato finale",
    max6: "Max 6 (Triennale)",
    max8: "Max 8 (Magistrale)",
    thesisPoints: "Punti elaborato",
    bands: {
      sufficiente: "Sufficiente",
      discreto: "Discreto",
      buono: "Buono",
      ottimo: "Ottimo",
      eccellente: "Eccellente",
    },
    scenTitle: "Scenari per punti elaborato",
    scenCol1: "Punti elaborato",
    scenCol2: "Voto finale",
    maxTag: "(max)",
    footer:
      "Strumento indicativo. Le regole esatte (bonus, soglie, lode) variano per corso di laurea: verifica sempre il regolamento del tuo dipartimento.",
    tooltip30L: "30 e Lode (vale 33)",
    tooltipAP: "Idoneità / Altre attività — escluso dalla media",
    removeExam: "Rimuovi esame",
  },
  en: {
    title: "Graduation Grade Calculator",
    subtitle: "University of Milan · valid for all faculties",
    tagline: "Made by a UniMi student, for UniMi students",
    themeDark: "Dark",
    themeLight: "Light",
    importTitle: "Import your transcript (PDF or screenshot)",
    importDesc:
      "Upload your academic transcript: the AI reads the document and automatically fills in the exam table, so you don't have to enter them one by one.",
    fileLabel: "Files (PDF or images, one or more)",
    filesSelected: (n) => `${n} file${n === 1 ? "" : "s"} selected`,
    extract: "Extract exams",
    extracting: "Extracting…",
    privacyNote:
      "Files are sent to our server, processed by AI and immediately discarded: no data is stored. Always double-check the imported exams before relying on the result.",
    errNoFiles: "Upload at least one PDF or screenshot of your transcript.",
    errBadFormat: "Unsupported file format: use PDF or images.",
    errTooLarge:
      "Files too large (max ~9 MB total). Upload fewer pages or reduce resolution.",
    errNoExams: "No exams recognized in the document.",
    errNoValid: "No valid exams extracted.",
    imported: (n) => `Imported ${n} exams. Please review and fix any errors.`,
    examsTitle: "Exams taken",
    colName: "Exam name",
    colGrade: "Grade",
    colCfu: "Credits",
    optional: "(optional)",
    addExam: "+ Add exam",
    totExams: "Exams (excl. AP)",
    totCfu: "Total credits",
    totAvg: "Weighted average",
    totBase: "Base score",
    resultTitle: "Final grade",
    enterExams: "Enter your exams",
    honorsLine: "cum laude 🎓",
    honors110: "110 cum laude",
    brkSession: "+ Session",
    brkErasmus: "+ Erasmus / Mobility",
    brkLaureando: "+ On-time graduation",
    brkExtra: "+ Extra bonus",
    brkThesis: "+ Final thesis",
    brkRaw: "Subtotal",
    badgeOk: "✓ Honors achievable",
    badgeNo: "✗ Honors not achievable",
    maxTheoretical: "theoretical max",
    honorsNote: "Honors (cum laude) require a unanimous vote of the committee.",
    bonusTitle: "Bonuses",
    sessionLabel: "Graduation session",
    sessions: {
      nessuna: "None",
      straordinaria: "Extraordinary",
      invernale: "Winter",
      primaverile: "Spring",
      estiva: "Summer",
      autunnale: "Autumn",
    },
    erasmusLabel: "Erasmus / International mobility",
    laureandoLabel: "On-time graduation",
    extraBonusLabel: "Extra bonus (faculty-specific)",
    pt: "pt",
    thesisTitle: "Final thesis",
    max6: "Max 6 (Bachelor's)",
    max8: "Max 8 (Master's)",
    thesisPoints: "Thesis points",
    bands: {
      sufficiente: "Sufficient",
      discreto: "Fair",
      buono: "Good",
      ottimo: "Very good",
      eccellente: "Excellent",
    },
    scenTitle: "Scenarios by thesis points",
    scenCol1: "Thesis points",
    scenCol2: "Final grade",
    maxTag: "(max)",
    footer:
      "Indicative tool. The exact rules (bonuses, thresholds, honors) vary by degree program: always check your department's regulations.",
    tooltip30L: "30 with honors (counts as 33)",
    tooltipAP: "Pass/Idoneità — excluded from the average",
    removeExam: "Remove exam",
  },
};

// Sessioni di laurea con relativo bonus (il nome arriva dalle traduzioni)
const SESSIONS = [
  { id: "nessuna", pts: 0 },
  { id: "straordinaria", pts: 1 },
  { id: "invernale", pts: 2 },
  { id: "primaverile", pts: 2 },
  { id: "estiva", pts: 2 },
  { id: "autunnale", pts: 3 },
];

// Fasce qualitative dell'elaborato finale (label dalle traduzioni)
const THESIS_BANDS = [
  { key: "sufficiente", range: "0", min: 0 },
  { key: "discreto", range: "1–2", min: 1 },
  { key: "buono", range: "3–4", min: 3 },
  { key: "ottimo", range: "5–6", min: 5 },
  { key: "eccellente", range: "7–8", min: 7 },
];

// Voto "effettivo" di un esame (33 per 30L, null se AP/idoneità o non valido)
function effectiveVote(e) {
  if (e.special === "AP") return null;
  if (e.special === "30L") return 33;
  const v = parseInt(e.voto, 10);
  if (Number.isFinite(v) && v >= 18 && v <= 30) return v;
  return null;
}

let _nextId = 0;
const newExam = (name = "", voto = "", cfu = "") => ({
  id: ++_nextId,
  name,
  voto,
  cfu,
  special: null, // null | "30L" | "AP"
});

// ---------------------------------------------------------------------------
// Import carriera: i file vanno al backend, che custodisce la API key e chiama
// l'AI. I visitatori non inseriscono alcuna chiave. (rewrite Hosting /api/extract)
// ---------------------------------------------------------------------------
const EXTRACT_ENDPOINT =
  (import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "") + "/api/extract";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}

export default function CalcolatoreVotoLaurea() {
  // ---- Tema e lingua ----
  const [theme, setTheme] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  );
  const [lang, setLang] = useState("it");
  const dark = theme === "dark";
  const C = THEMES[theme];
  const t = TRANSLATIONS[lang];

  // ---- Stato esami ----
  const [exams, setExams] = useState(() => [
    newExam("", "28", "9"),
    newExam("", "30", "6"),
    newExam("", "", ""),
  ]);
  const [sessionId, setSessionId] = useState("estiva");
  const [erasmus, setErasmus] = useState(false);
  const [laureando, setLaureando] = useState(false);
  const [bonusExtra, setBonusExtra] = useState("0");
  const [thesisMax, setThesisMax] = useState(6);
  const [thesis, setThesis] = useState(0);

  // Layout responsive: collassa a colonna singola sotto i 600px.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 599px)").matches
      : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 599px)");
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ---- Stato import carriera (PDF/screenshot → backend → AI) ----
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importMsg, setImportMsg] = useState("");

  // ---- Handler tabella esami ----
  const addExam = () => setExams((xs) => [...xs, newExam()]);
  const removeExam = (id) => setExams((xs) => xs.filter((e) => e.id !== id));
  const updateExam = (id, patch) =>
    setExams((xs) => xs.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const toggleSpecial = (id, flag) =>
    setExams((xs) =>
      xs.map((e) =>
        e.id === id ? { ...e, special: e.special === flag ? null : flag } : e
      )
    );

  const setThesisMaxAndClamp = (max) => {
    setThesisMax(max);
    setThesis((v) => Math.min(v, max));
  };

  // ---- Estrazione esami dalla carriera ----
  const extractExams = async () => {
    setImportError("");
    setImportMsg("");
    if (!files.length) {
      setImportError(t.errNoFiles);
      return;
    }
    setImporting(true);
    try {
      const payload = [];
      let totalBytes = 0;
      for (const f of files) {
        if (f.type !== "application/pdf" && !f.type.startsWith("image/")) continue;
        const data = await fileToBase64(f);
        totalBytes += data.length;
        payload.push({ media_type: f.type, data });
      }
      if (!payload.length) throw new Error(t.errBadFormat);
      if (totalBytes > 12_000_000) throw new Error(t.errTooLarge);

      const appCheckToken = await getAppCheckToken();
      const headers = { "content-type": "application/json" };
      if (appCheckToken) headers["X-Firebase-AppCheck"] = appCheckToken;

      const res = await fetch(EXTRACT_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ files: payload }),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.error || msg;
        } catch (_e) {
          /* corpo non JSON */
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const esami = data?.esami;
      if (!Array.isArray(esami) || !esami.length) throw new Error(t.errNoExams);

      const imported = esami
        .map((e) => {
          const raw = String(e.voto ?? "").trim().toUpperCase();
          let special = null;
          let voto = "";
          if (raw === "AP" || raw.includes("IDONE")) {
            special = "AP";
          } else if (raw === "30L" || raw.includes("LODE")) {
            special = "30L";
          } else {
            const n = parseInt(raw, 10);
            if (Number.isFinite(n) && n >= 18 && n <= 30) voto = String(n);
          }
          const cfuNum = parseFloat(e.cfu);
          const cfu = Number.isFinite(cfuNum) ? String(cfuNum) : "";
          if (!special && voto === "" && cfu === "") return null;
          return {
            id: ++_nextId,
            name: e.nome ? String(e.nome) : "",
            voto,
            cfu,
            special,
          };
        })
        .filter(Boolean);

      if (!imported.length) throw new Error(t.errNoValid);
      setExams(imported);
      setImportMsg(t.imported(imported.length));
    } catch (err) {
      setImportError(err.message || String(err));
    } finally {
      setImporting(false);
    }
  };

  // ---- Calcoli derivati ----
  const calc = useMemo(() => {
    const graded = exams.filter((e) => {
      const v = effectiveVote(e);
      const cfu = parseFloat(e.cfu);
      return v != null && Number.isFinite(cfu) && cfu > 0;
    });
    let weighted = 0;
    let totalCFU = 0;
    for (const e of graded) {
      weighted += effectiveVote(e) * parseFloat(e.cfu);
      totalCFU += parseFloat(e.cfu);
    }
    const media = totalCFU > 0 ? weighted / totalCFU : 0;
    const base = media * (110 / 30);
    return { examCount: graded.length, totalCFU, media, base };
  }, [exams]);

  const session = SESSIONS.find((s) => s.id === sessionId) || SESSIONS[0];
  const sessionBonus = session.pts;
  const erasmusBonus = erasmus ? 2 : 0;
  const laureandoBonus = laureando ? 1 : 0;
  const extraBonus = Number.isFinite(parseFloat(bonusExtra))
    ? parseFloat(bonusExtra)
    : 0;
  const bonusTotal = sessionBonus + erasmusBonus + laureandoBonus + extraBonus;

  const hasExams = calc.totalCFU > 0;
  const lordo = calc.base + bonusTotal + thesis;
  const finalGrade = Math.round(lordo);
  const isLode = hasExams && finalGrade > 110;
  const displayGrade = Math.min(finalGrade, 110);

  const maxLordo = calc.base + bonusTotal + thesisMax;
  const maxFinal = Math.round(maxLordo);
  const lodeReachable = hasExams && maxFinal > 110;

  const scenarios = useMemo(() => {
    const rows = [];
    for (let v = 0; v <= thesisMax; v++) {
      const l = calc.base + bonusTotal + v;
      const f = Math.round(l);
      rows.push({ t: v, final: f, lode: f > 110, display: Math.min(f, 110) });
    }
    return rows;
  }, [calc.base, bonusTotal, thesisMax]);

  const bands = THESIS_BANDS.filter((b) => b.min <= thesisMax);
  const sessionName = (id) => t.sessions[id];
  const sessionOptionLabel = (s) =>
    `${sessionName(s.id)} (${s.pts === 0 ? "0" : "+" + s.pts})`;

  // ---- Stili ----
  const S = {
    page: {
      minHeight: "100vh",
      background: C.pageBg,
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: C.text,
      padding: isMobile ? "12px" : "24px",
      boxSizing: "border-box",
      transition: "background 0.2s, color 0.2s",
    },
    wrap: { maxWidth: 1080, margin: "0 auto" },
    header: {
      background: "linear-gradient(135deg, #1e1b4b, #4338ca)",
      borderRadius: 18,
      padding: isMobile ? "20px 18px" : "28px 32px",
      color: "#fff",
      marginBottom: 18,
    },
    headerTitle: {
      margin: 0,
      fontSize: isMobile ? 22 : 28,
      fontWeight: 800,
      letterSpacing: -0.5,
    },
    headerSub: { margin: "8px 0 0", opacity: 0.85, fontSize: 14 },
    tagline: {
      margin: "12px 0 0",
      fontSize: 13,
      fontStyle: "italic",
      opacity: 0.9,
    },
    card: {
      background: C.card,
      borderRadius: 14,
      boxShadow: C.shadow,
      padding: isMobile ? "16px" : "20px",
    },
    cardTitle: { margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: C.heading },
    grid2: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1.25fr 1fr",
      gap: 18,
      marginBottom: 18,
      alignItems: "start",
    },
    grid2eq: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      gap: 18,
      marginBottom: 18,
      alignItems: "start",
    },
    th: {
      textAlign: "left",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: C.muted,
      padding: "6px 8px",
      fontWeight: 700,
    },
    td: { padding: "5px 8px", verticalAlign: "middle" },
    input: {
      width: "100%",
      padding: "8px 10px",
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      fontSize: 14,
      boxSizing: "border-box",
      fontFamily: "inherit",
      background: C.inputBg,
      color: C.text,
    },
    smallInput: {
      width: "100%",
      padding: "8px 8px",
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      fontSize: 14,
      boxSizing: "border-box",
      textAlign: "center",
      fontFamily: "inherit",
      background: C.inputBg,
      color: C.text,
    },
    addBtn: {
      marginTop: 12,
      background: ACCENT,
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "10px 16px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
    },
    primaryBtn: {
      background: ACCENT,
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "10px 16px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
    },
    totalsRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 14,
      marginTop: 14,
      paddingTop: 14,
      borderTop: `1px solid ${C.divider}`,
    },
    totalBox: { flex: "1 1 110px", minWidth: 100 },
    totalLabel: { fontSize: 12, color: C.muted, marginBottom: 2 },
    totalVal: { fontSize: 18, fontWeight: 700, color: C.heading },
    field: { marginBottom: 14 },
    label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 },
    checkRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 0",
      fontSize: 14,
    },
    range: { width: "100%", accentColor: ACCENT, marginTop: 6 },
    breakLine: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 14,
      padding: "5px 0",
    },
    badge: (ok) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      marginTop: 14,
      padding: "8px 14px",
      borderRadius: 999,
      fontWeight: 700,
      fontSize: 14,
      background: ok ? C.okBg : C.errBg,
      color: ok ? C.greenText : C.errText,
      border: `1px solid ${ok ? C.okBorder : C.errBorder}`,
    }),
  };

  const toggleBtn = (active, accent) => ({
    border: `1px solid ${active ? accent : C.border}`,
    background: active ? accent : C.ghostBg,
    color: active ? "#fff" : C.ghostText,
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    minWidth: 38,
  });

  // Pulsanti nell'header (sopra il gradiente)
  const headerBtn = {
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: 9,
    padding: "7px 11px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  };
  const langSeg = (active) => ({
    background: active ? "#fff" : "transparent",
    color: active ? "#1e1b4b" : "#fff",
    border: "none",
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  });

  const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* ---- Header ---- */}
        <div style={S.header}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={S.headerTitle}>{t.title}</h1>
              <p style={S.headerSub}>{t.subtitle}</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                style={headerBtn}
                onClick={() => setTheme(dark ? "light" : "dark")}
                aria-label={dark ? t.themeLight : t.themeDark}
              >
                {dark ? "☀️" : "🌙"} {dark ? t.themeLight : t.themeDark}
              </button>
              <div
                style={{
                  display: "inline-flex",
                  border: "1px solid rgba(255,255,255,0.35)",
                  borderRadius: 9,
                  overflow: "hidden",
                }}
              >
                <button type="button" style={langSeg(lang === "it")} onClick={() => setLang("it")}>
                  IT
                </button>
                <button type="button" style={langSeg(lang === "en")} onClick={() => setLang("en")}>
                  EN
                </button>
              </div>
            </div>
          </div>
          <p style={S.tagline}>{t.tagline}</p>
        </div>

        {/* ---- Import carriera ---- */}
        <div style={{ ...S.card, marginBottom: 18 }}>
          <h2 style={S.cardTitle}>{t.importTitle}</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: C.muted }}>{t.importDesc}</p>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <label style={S.label}>{t.fileLabel}</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(ev) => {
                  setFiles(Array.from(ev.target.files || []));
                  setImportError("");
                  setImportMsg("");
                }}
                style={{ width: "100%", fontSize: 13, color: C.text }}
              />
              {files.length > 0 && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                  {t.filesSelected(files.length)}
                </div>
              )}
            </div>
            <button
              type="button"
              style={{
                ...S.primaryBtn,
                padding: "11px 20px",
                opacity: importing ? 0.7 : 1,
                cursor: importing ? "default" : "pointer",
              }}
              disabled={importing}
              onClick={extractExams}
            >
              {importing ? t.extracting : t.extract}
            </button>
          </div>

          {importError && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: C.errBg,
                color: C.errText,
                fontSize: 13,
                border: `1px solid ${C.errBorder}`,
              }}
            >
              ⚠️ {importError}
            </div>
          )}
          {importMsg && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: C.okBg,
                color: C.okText,
                fontSize: 13,
                border: `1px solid ${C.okBorder}`,
              }}
            >
              ✓ {importMsg}
            </div>
          )}

          <p style={{ fontSize: 11, color: C.faint, margin: "12px 0 0" }}>{t.privacyNote}</p>
        </div>

        {/* ---- Tabella esami + Risultato ---- */}
        <div style={S.grid2}>
          {/* Tabella esami */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t.examsTitle}</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                <thead>
                  <tr>
                    <th style={S.th}>{t.colName}</th>
                    <th style={{ ...S.th, width: 170 }}>{t.colGrade}</th>
                    <th style={{ ...S.th, width: 80 }}>{t.colCfu}</th>
                    <th style={{ ...S.th, width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {exams.map((e) => {
                    const isAP = e.special === "AP";
                    const is30L = e.special === "30L";
                    return (
                      <tr key={e.id}>
                        <td style={S.td}>
                          <input
                            style={S.input}
                            type="text"
                            placeholder={t.optional}
                            value={e.name}
                            onChange={(ev) => updateExam(e.id, { name: ev.target.value })}
                          />
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input
                              style={{ ...S.smallInput, width: 56, opacity: isAP || is30L ? 0.4 : 1 }}
                              type="number"
                              min={18}
                              max={30}
                              placeholder="18–30"
                              disabled={isAP || is30L}
                              value={is30L || isAP ? "" : e.voto}
                              onChange={(ev) => updateExam(e.id, { voto: ev.target.value })}
                            />
                            <button
                              type="button"
                              style={toggleBtn(is30L, ACCENT)}
                              onClick={() => toggleSpecial(e.id, "30L")}
                              title={t.tooltip30L}
                            >
                              30L
                            </button>
                            <button
                              type="button"
                              style={toggleBtn(isAP, GREEN)}
                              onClick={() => toggleSpecial(e.id, "AP")}
                              title={t.tooltipAP}
                            >
                              AP
                            </button>
                          </div>
                        </td>
                        <td style={S.td}>
                          <input
                            style={S.smallInput}
                            type="number"
                            min={0}
                            placeholder="6"
                            value={e.cfu}
                            onChange={(ev) => updateExam(e.id, { cfu: ev.target.value })}
                          />
                        </td>
                        <td style={{ ...S.td, textAlign: "center" }}>
                          <button
                            type="button"
                            aria-label={t.removeExam}
                            onClick={() => removeExam(e.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: C.faint,
                              cursor: "pointer",
                              padding: 4,
                              display: "inline-flex",
                            }}
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button type="button" style={S.addBtn} onClick={addExam}>
              {t.addExam}
            </button>

            {/* Totali in tempo reale */}
            <div style={S.totalsRow}>
              <div style={S.totalBox}>
                <div style={S.totalLabel}>{t.totExams}</div>
                <div style={S.totalVal}>{calc.examCount}</div>
              </div>
              <div style={S.totalBox}>
                <div style={S.totalLabel}>{t.totCfu}</div>
                <div style={S.totalVal}>
                  {Number.isInteger(calc.totalCFU) ? calc.totalCFU : calc.totalCFU.toFixed(1)}
                </div>
              </div>
              <div style={S.totalBox}>
                <div style={S.totalLabel}>{t.totAvg}</div>
                <div style={S.totalVal}>{hasExams ? calc.media.toFixed(4) : "—"}</div>
              </div>
              <div style={S.totalBox}>
                <div style={S.totalLabel}>{t.totBase}</div>
                <div style={S.totalVal}>{hasExams ? calc.base.toFixed(3) : "—"}</div>
              </div>
            </div>
          </div>

          {/* Risultato */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t.resultTitle}</h2>
            <div style={{ textAlign: "center", padding: "6px 0 10px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize: isMobile ? 56 : 68, fontWeight: 800, lineHeight: 1, color: hasExams ? gradeColor(finalGrade, dark) : C.faint }}>
                  {hasExams ? displayGrade : "–"}
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: C.faint }}>/110</span>
              </div>
              {hasExams && isLode && (
                <div style={{ marginTop: 6, fontWeight: 800, color: gradeColor(111, dark), fontSize: 18 }}>
                  {t.honorsLine}
                </div>
              )}
              {!hasExams && (
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700, color: C.faint }}>
                  {t.enterExams}
                </div>
              )}
            </div>

            {/* Dettaglio calcolo */}
            <div style={{ background: C.panel, borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
              <div style={S.breakLine}>
                <span style={{ color: C.muted }}>{t.totAvg}</span>
                <strong>{hasExams ? calc.media.toFixed(4) : "—"} / 30</strong>
              </div>
              <div style={S.breakLine}>
                <span style={{ color: C.muted }}>{t.totBase}</span>
                <strong>{hasExams ? calc.base.toFixed(3) : "—"} / 110</strong>
              </div>
              {sessionBonus !== 0 && (
                <div style={S.breakLine}>
                  <span style={{ color: C.muted }}>{t.brkSession} {sessionName(session.id)}</span>
                  <strong style={{ color: C.greenText }}>+{sessionBonus}</strong>
                </div>
              )}
              {erasmusBonus !== 0 && (
                <div style={S.breakLine}>
                  <span style={{ color: C.muted }}>{t.brkErasmus}</span>
                  <strong style={{ color: C.greenText }}>+{erasmusBonus}</strong>
                </div>
              )}
              {laureandoBonus !== 0 && (
                <div style={S.breakLine}>
                  <span style={{ color: C.muted }}>{t.brkLaureando}</span>
                  <strong style={{ color: C.greenText }}>+{laureandoBonus}</strong>
                </div>
              )}
              {extraBonus !== 0 && (
                <div style={S.breakLine}>
                  <span style={{ color: C.muted }}>{t.brkExtra}</span>
                  <strong style={{ color: C.greenText }}>{extraBonus > 0 ? "+" : ""}{extraBonus}</strong>
                </div>
              )}
              <div style={S.breakLine}>
                <span style={{ color: C.muted }}>{t.brkThesis}</span>
                <strong style={{ color: C.greenText }}>+{thesis} {t.pt}</strong>
              </div>
              <div style={{ ...S.breakLine, borderTop: `1px solid ${C.divider2}`, marginTop: 6, paddingTop: 8 }}>
                <span style={{ color: C.muted }}>{t.brkRaw}</span>
                <span>
                  <strong>{hasExams ? lordo.toFixed(3) : "—"}</strong>{" "}
                  <span style={{ color: C.faint }}>→</span>{" "}
                  <strong style={{ color: hasExams ? gradeColor(finalGrade, dark) : C.faint }}>
                    {hasExams ? (isLode ? t.honors110 : finalGrade) : "—"} / 110
                  </strong>
                </span>
              </div>
            </div>

            {/* Badge lode */}
            <div style={S.badge(lodeReachable)}>
              {lodeReachable ? t.badgeOk : t.badgeNo}
              <span style={{ fontWeight: 500, opacity: 0.85 }}>
                ({t.maxTheoretical}: {hasExams ? maxFinal : "—"})
              </span>
            </div>
            <p style={{ fontSize: 11, color: C.faint, margin: "8px 0 0" }}>{t.honorsNote}</p>
          </div>
        </div>

        {/* ---- Bonus + Elaborato ---- */}
        <div style={S.grid2eq}>
          {/* Bonus */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t.bonusTitle}</h2>
            <div style={S.field}>
              <label style={S.label} htmlFor="sessione">{t.sessionLabel}</label>
              <select
                id="sessione"
                style={S.input}
                value={sessionId}
                onChange={(ev) => setSessionId(ev.target.value)}
              >
                {SESSIONS.map((s) => (
                  <option key={s.id} value={s.id}>{sessionOptionLabel(s)}</option>
                ))}
              </select>
            </div>

            <label style={S.checkRow}>
              <input type="checkbox" checked={erasmus} onChange={(ev) => setErasmus(ev.target.checked)} style={{ accentColor: ACCENT, width: 16, height: 16 }} />
              {t.erasmusLabel} <span style={{ color: C.greenText, fontWeight: 700 }}>+2 {t.pt}</span>
            </label>
            <label style={S.checkRow}>
              <input type="checkbox" checked={laureando} onChange={(ev) => setLaureando(ev.target.checked)} style={{ accentColor: ACCENT, width: 16, height: 16 }} />
              {t.laureandoLabel} <span style={{ color: C.greenText, fontWeight: 700 }}>+1 {t.pt}</span>
            </label>

            <div style={{ ...S.field, marginTop: 12 }}>
              <label style={S.label} htmlFor="bonusExtra">{t.extraBonusLabel}</label>
              <input
                id="bonusExtra"
                style={S.input}
                type="number"
                step="0.5"
                value={bonusExtra}
                onChange={(ev) => setBonusExtra(ev.target.value)}
              />
            </div>
          </div>

          {/* Elaborato finale */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t.thesisTitle}</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                style={{ ...S.primaryBtn, flex: 1, background: thesisMax === 6 ? ACCENT : C.ghostBg, color: thesisMax === 6 ? "#fff" : C.ghostText, border: "1px solid " + (thesisMax === 6 ? ACCENT : C.border) }}
                onClick={() => setThesisMaxAndClamp(6)}
              >
                {t.max6}
              </button>
              <button
                type="button"
                style={{ ...S.primaryBtn, flex: 1, background: thesisMax === 8 ? ACCENT : C.ghostBg, color: thesisMax === 8 ? "#fff" : C.ghostText, border: "1px solid " + (thesisMax === 8 ? ACCENT : C.border) }}
                onClick={() => setThesisMaxAndClamp(8)}
              >
                {t.max8}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.thesisPoints}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: C.accentText }}>+{thesis}</span>
            </div>
            <input
              type="range"
              min={0}
              max={thesisMax}
              step={1}
              value={thesis}
              onChange={(ev) => setThesis(parseInt(ev.target.value, 10))}
              style={S.range}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 4 }}>
              {bands.map((b) => (
                <div key={b.key} style={{ textAlign: "center", flex: "1 1 0", minWidth: 60 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.accentText }}>{t.bands[b.key]}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>({b.range})</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Tabella scenari ---- */}
        <div style={S.card}>
          <h2 style={S.cardTitle}>{t.scenTitle}</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={S.th}>{t.scenCol1}</th>
                  <th style={{ ...S.th, textAlign: "center" }}>{t.scenCol2}</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((row) => {
                  const selected = row.t === thesis;
                  return (
                    <tr key={row.t}>
                      <td style={{ ...S.td, fontWeight: selected ? 800 : 500, color: selected ? C.heading : C.text }}>
                        {selected && <span style={{ color: C.accentText, marginRight: 6 }}>▶</span>}
                        +{row.t} {t.pt}
                        {row.t === thesisMax && <span style={{ color: C.faint, fontWeight: 400 }}> {t.maxTag}</span>}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            minWidth: 96,
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontWeight: 800,
                            background: hasExams ? cellBg(row.final, dark) : C.cellEmpty,
                            color: hasExams ? gradeColor(row.final, dark) : C.faint,
                            outline: selected ? `2px solid ${ACCENT}` : "none",
                            outlineOffset: -2,
                          }}
                        >
                          {hasExams ? (row.lode ? t.honors110 : row.display) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ textAlign: "center", color: C.faint, fontSize: 12, margin: "18px 0 8px" }}>
          {t.footer}
        </p>
      </div>
    </div>
  );
}
