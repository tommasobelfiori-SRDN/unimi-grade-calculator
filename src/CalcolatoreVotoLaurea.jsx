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
    disclaimerHeader:
      "Sito non ufficiale, non affiliato all'Università degli Studi di Milano. Strumento puramente indicativo.",
    themeDark: "Scuro",
    themeLight: "Chiaro",
    contact: "Contattami",
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
    legend30L: "= 30 e lode",
    legendAP: "= idoneità o attività senza voto numerico (es. tirocini, prova di lingua): esclusa dalla media",
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
    sessOpts: {
      estiva: "Estiva",
      autunnale: "Autunnale",
      invernale: "Invernale",
      fuoricorso: "Fuori corso",
    },
    brkInCorso: "+ In corso",
    notApplicable: "non prevista",
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
    tooltip30L: "Esame con 30 e lode",
    tooltipAP: "Idoneità / Altre attività — escluso dalla media",
    removeExam: "Rimuovi esame",
    facultyTitle: "Corso di laurea / Facoltà",
    facultyLabel: "Facoltà",
    levelLabel: "Livello",
    triennale: "Triennale",
    magistrale: "Magistrale / Ciclo unico",
    rulesHeading: "Regole della facoltà",
    sourceLabel: "Fonte ufficiale",
    facultyDisclaimer:
      "Il preset imposta i punti tesi massimi e il valore del “30 e lode” nella media. I bonus variano per corso: applicali nei campi sotto seguendo la nota. Verifica sempre il regolamento del tuo corso.",
  },
  en: {
    title: "Graduation Grade Calculator",
    subtitle: "University of Milan · valid for all faculties",
    tagline: "Made by a UniMi student, for UniMi students",
    disclaimerHeader:
      "Unofficial tool, not affiliated with the University of Milan. For guidance only.",
    themeDark: "Dark",
    themeLight: "Light",
    contact: "Contact me",
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
    legend30L: "= 30 with honors (30 e lode)",
    legendAP: "= pass / activity with no numeric grade (e.g. internships, language test): excluded from the average",
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
    sessOpts: {
      estiva: "Summer",
      autunnale: "Autumn",
      invernale: "Winter",
      fuoricorso: "Off-track",
    },
    brkInCorso: "+ On-time",
    notApplicable: "not available",
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
    tooltip30L: "Exam passed with 30 cum laude",
    tooltipAP: "Pass/Idoneità — excluded from the average",
    removeExam: "Remove exam",
    facultyTitle: "Degree programme / Faculty",
    facultyLabel: "Faculty",
    levelLabel: "Level",
    triennale: "Bachelor",
    magistrale: "Master / Single-cycle",
    rulesHeading: "Faculty rules",
    sourceLabel: "Official source",
    facultyDisclaimer:
      "The preset sets the max thesis points and the value of “30 cum laude” in the average. Bonuses vary by programme: apply them in the fields below following the note. Always check your programme's regulation.",
  },
};

// Fasce qualitative dell'elaborato finale (label dalle traduzioni)
const THESIS_BANDS = [
  { key: "sufficiente", range: "0", min: 0 },
  { key: "discreto", range: "1–2", min: 1 },
  { key: "buono", range: "3–4", min: 3 },
  { key: "ottimo", range: "5–6", min: 5 },
  { key: "eccellente", range: "7–8", min: 7 },
];

// ---------------------------------------------------------------------------
// Facoltà UniMi e preset (regole da regolamenti ufficiali — vedi docs/regolamenti-unimi.md)
// tri/mag: { thesisMax (punti tesi max), lode30 (valore del "30 e lode" nella media) }
// I valori variano per corso: sono il default a livello di facoltà, sempre modificabili.
// ---------------------------------------------------------------------------
const FACULTIES = [
  {
    id: "generica",
    it: "Generica / altro corso",
    en: "Generic / other programme",
    tri: { thesisMax: 6, lode30: 33, inCorso: { estiva: 1, autunnale: 1, invernale: 1 }, erasmus: 2 },
    mag: { thesisMax: 8, lode30: 33, inCorso: { estiva: 1, autunnale: 1, invernale: 1 }, erasmus: 2 },
    src: null,
    note: {
      it: "Valori generici (media ponderata ×110/30, 30 e lode = 33, punti tesi 6/8, in corso +1, Erasmus +2). Le regole reali variano molto per corso: scegli la tua facoltà o verifica il regolamento del tuo corso.",
      en: "Generic values (weighted avg ×110/30, 30 with honors = 33, thesis 6/8, on-time +1, Erasmus +2). Real rules vary a lot by programme: pick your faculty or check your programme regulation.",
    },
  },
  {
    id: "giurisprudenza",
    it: "Giurisprudenza",
    en: "Law",
    tri: { thesisMax: 5, lode30: 31, inCorso: { estiva: 1, autunnale: 1, invernale: 1 }, erasmus: 1 },
    mag: { thesisMax: 6, lode30: 30, inCorso: { estiva: 1, autunnale: 1, invernale: 1 }, erasmus: 1 },
    src: { url: "https://giurisprudenza.cdl.unimi.it/sites/la41/files/2021-12/Regolamento%20esami%20di%20laurea%20in%20Giurisprudenza%20NUOVO.pdf", date: "24/11/2021" },
    note: {
      it: "30 e lode = 31 (triennale) / 30 (ciclo unico). Tesi: triennale fino a 5, ciclo unico fino a 6. In corso: +1 (qualsiasi sessione, NON dipende dalla sessione). Erasmus +1; triennale anche moot/summer +1 e tirocinio +1 (tot bonus max 3, usa 'Bonus aggiuntivo'). ⚠️ Ciclo unico: in corso ed Erasmus sono ALTERNATIVI (max 1 combinato). Lode a 110 (ciclo unico: serve ≥1 lode in carriera).",
      en: "30 cum laude = 31 (bachelor) / 30 (single-cycle). Thesis: bachelor up to 5, single-cycle up to 6. On-time: +1 (any session, NOT session-dependent). Erasmus +1; bachelor also moot/summer +1 and internship +1 (total bonus max 3, use 'Extra bonus'). ⚠️ Single-cycle: on-time and Erasmus are ALTERNATIVE (max 1 combined). Honors at 110 (single-cycle: needs ≥1 cum laude in career).",
    },
  },
  {
    id: "spes",
    it: "Scienze Politiche, Economiche e Sociali",
    en: "Political, Economic and Social Sciences",
    tri: { thesisMax: 6, lode30: 33, inCorso: { estiva: 3, autunnale: 3, invernale: 1 }, erasmus: 1 },
    mag: { thesisMax: 11, lode30: 33, inCorso: { estiva: 0, autunnale: 0, invernale: 0 }, erasmus: 1 },
    src: { url: "https://spo.cdl.unimi.it/sites/lb19/files/2025-03/Attribuzione_punteggi_prove_finali_%28v._dic%202024%29_1.pdf", date: "25/11/2024" },
    note: {
      it: "30 e lode = 33. Tesi: triennale fino a 6, magistrale fino a 11. In corso (SOLO triennale): +3 se ti laurei nella sessione estiva o autunnale del 3° anno, +1 nella invernale. Erasmus/mobilità +1 (le varie mobilità non si sommano). Magistrale: nessun bonus in corso. Lode a 110 unanime.",
      en: "30 cum laude = 33. Thesis: bachelor up to 6, master up to 11. On-time (BACHELOR only): +3 if you graduate in the summer or autumn session of the 3rd year, +1 in the winter one. Erasmus/mobility +1 (the various mobilities don't stack). Master: no on-time bonus. Honors at 110, unanimous.",
    },
  },
  {
    id: "scienze",
    it: "Scienze e Tecnologie",
    en: "Science and Technology",
    tri: { thesisMax: 8, lode30: 33, inCorso: { estiva: 0, autunnale: 0, invernale: 0 }, erasmus: 0 },
    mag: { thesisMax: 8, lode30: 33, inCorso: { estiva: 0, autunnale: 0, invernale: 0 }, erasmus: 0 },
    src: { url: "https://www.unimi.it/en/study/bachelor-and-master-study/graduation/procedures-and-deadlines-degree-programmes/graduating-science-and-technology", date: "2024–2025" },
    note: {
      it: "⚠️ Area molto eterogenea: ogni corso ha regole proprie e NESSUN bonus dipende dalla sessione. Esempi: Chimica triennale +2 in corso (entro il 3° anno); Matematica triennale +2 in corso / +1 se ≤1 anno fuori corso; Biotecnologia +1 in corso + Erasmus +1; Fisica/Chimica/Biologia danno bonus per le lodi (~0,25–0,3 cad). Informatica usa la scala /30. Imposta i bonus del tuo corso nel campo 'Bonus aggiuntivo' e verifica le linee guida.",
      en: "⚠️ Very heterogeneous area: each programme has its own rules and NO bonus depends on the session. Examples: Chemistry bachelor +2 on-time (within 3rd year); Maths bachelor +2 on-time / +1 if ≤1 year late; Biotech +1 on-time + Erasmus +1; Physics/Chemistry/Biology give cum-laude bonuses (~0.25–0.3 each). Computer Science uses the /30 scale. Enter your programme's bonuses in 'Extra bonus' and check the guidelines.",
    },
  },
  {
    id: "umanistici",
    it: "Studi Umanistici",
    en: "Humanities",
    tri: { thesisMax: 6, lode30: 30, inCorso: { estiva: 0, autunnale: 0, invernale: 0 }, erasmus: 0 },
    mag: { thesisMax: 6, lode30: 30, inCorso: { estiva: 0, autunnale: 0, invernale: 0 }, erasmus: 0 },
    src: { url: "https://www.unimi.it/sites/default/files/2022-06/linee%20guida%20facolt%C3%A0%20pubblicate.pdf", date: "17/06/2022" },
    note: {
      it: "Voto = media ponderata ×110/30 + punti tesi 0–6 (sia triennale sia magistrale). NESSUN bonus: niente punti per laurea in corso, sessione, Erasmus o numero di lodi. Lode a 110 con voto unanime (decisa soprattutto sulla prova finale).",
      en: "Grade = weighted avg ×110/30 + thesis points 0–6 (both bachelor and master). NO bonuses: no points for on-time graduation, session, Erasmus or number of cum-laude exams. Honors at 110 with unanimous vote (decided mainly on the final exam).",
    },
  },
  {
    id: "medicina",
    it: "Medicina",
    en: "Medicine",
    tri: { thesisMax: 10, lode30: 30, inCorso: { estiva: 0, autunnale: 0, invernale: 0 }, erasmus: 0 },
    mag: { thesisMax: 7, lode30: 30, inCorso: { estiva: 1, autunnale: 1, invernale: 0 }, erasmus: 0 },
    src: { url: "https://www.unimi.it/sites/default/files/2025-10/DCA%20LM-41%20Medicina%20e%20chirurgia%20-%20polo%20centrale%20(2025).pdf", date: "13/10/2025" },
    note: {
      it: "Regole complesse e diverse per corso. Medicina e Chirurgia (LM-41, 2025): base + tesi fino a 7 + premialità fino a 7 (in corso +1 SOLO se ti laurei nella sessione estiva/autunnale; lodi 0,3 cad max 2; ricerca extra +2; OSCE +2). LODE a punteggio ≥ 113. Professioni sanitarie (triennali): base in /100 + tesi fino a 10 + prova abilitante fino a 10; lode a chi ha più lodi. Usa 'Bonus aggiuntivo' per lodi/OSCE/ricerca.",
      en: "Complex rules, differ by programme. Medicine & Surgery (LM-41, 2025): base + thesis up to 7 + rewards up to 7 (on-time +1 ONLY if you graduate in the summer/autumn session; cum laude 0.3 each max 2; extra research +2; OSCE +2). HONORS at score ≥ 113. Health professions (bachelors): base in /100 + thesis up to 10 + qualifying exam up to 10; honors to the one with most cum-laude. Use 'Extra bonus' for cum-laude/OSCE/research.",
    },
  },
  {
    id: "farmacia",
    it: "Scienze del Farmaco",
    en: "Pharmacy",
    tri: { thesisMax: 10, lode30: 33, inCorso: { estiva: 1, autunnale: 1, invernale: 1 }, erasmus: 1 },
    mag: { thesisMax: 10, lode30: 33, inCorso: { estiva: 1, autunnale: 1, invernale: 1 }, erasmus: 1 },
    src: { url: "https://ctf.cdl.unimi.it/sites/le25/files/2025-04/Calcolo%20voto%20laurea-luglio%202025.pdf", date: "07/2025" },
    note: {
      it: "Base = media ponderata ×110/30; 30 e lode = 33. Tesi: sperimentale fino a 10, semisperimentale 7,5, compilativa 5. In corso +1 (triennale/ciclo unico) o +0,5 (magistrale 2 anni), solo se ti laurei entro la sessione di marzo/aprile. Erasmus +1; tesi sperimentale all'estero +1 (≤6 mesi) o +2 (>6 mesi, usa 'Bonus aggiuntivo'). ⚠️ LODE: base + (in corso+Erasmus+estero) ≥ 102,00 non arrotondato (i punti tesi NON contano per la soglia).",
      en: "Base = weighted avg ×110/30; 30 cum laude = 33. Thesis: experimental up to 10, semi 7.5, compilation 5. On-time +1 (bachelor/single-cycle) or +0.5 (2-yr master), only if you graduate by the March/April session. Erasmus +1; experimental thesis abroad +1 (≤6 months) or +2 (>6 months, use 'Extra bonus'). ⚠️ HONORS: base + (on-time+Erasmus+abroad) ≥ 102.00 unrounded (thesis points do NOT count for the threshold).",
    },
  },
  {
    id: "agraria",
    it: "Scienze Agrarie e Alimentari",
    en: "Agricultural and Food Sciences",
    tri: { thesisMax: 6, lode30: 33, inCorso: { estiva: 3, autunnale: 3, invernale: 1 }, erasmus: 1 },
    mag: { thesisMax: 10, lode30: 30, inCorso: { estiva: 0, autunnale: 0, invernale: 0 }, erasmus: 0 },
    src: { url: "https://scienzeagrarie.cdl.unimi.it/sites/lg28/files/2022-07/Regolamento_votolaurea_Agraria_3.pdf", date: "24/02/2022" },
    note: {
      it: "Media ponderata ×110/30; 30 e lode = 33 (solo triennale). Tesi: triennale fino a 6, magistrale fino a 10 (include 1 punto per attività all'estero). In corso (SOLO triennale): +3 nella 1ª/2ª sessione (estiva/autunnale), +1 nella 3ª (invernale). Erasmus/estero +1 (1ª/2ª) o +2 (3ª, usa 'Bonus aggiuntivo'). Magistrale: nessun bonus in corso. Lode a 110 unanime.",
      en: "Weighted avg ×110/30; 30 cum laude = 33 (bachelor only). Thesis: bachelor up to 6, master up to 10 (includes 1 point for activity abroad). On-time (BACHELOR only): +3 in the 1st/2nd session (summer/autumn), +1 in the 3rd (winter). Erasmus/abroad +1 (1st/2nd) or +2 (3rd, use 'Extra bonus'). Master: no on-time bonus. Honors at 110, unanimous.",
    },
  },
  {
    id: "veterinaria",
    it: "Medicina Veterinaria",
    en: "Veterinary Medicine",
    tri: { thesisMax: 8, lode30: 33, inCorso: { estiva: 3, autunnale: 3, invernale: 2 }, erasmus: 3 },
    mag: { thesisMax: 10, lode30: 30, inCorso: { estiva: 1, autunnale: 1, invernale: 1 }, erasmus: 1 },
    src: { url: "https://veterinaria.cdl.unimi.it/sites/lh15/files/2024-05/Regolamento%20della%20prova%20finale%20(immatricolati%20a%20partire%20dall'aa%202023-24).pdf", date: "09/05/2024" },
    note: {
      it: "Medicina Veterinaria (ciclo unico LM-42, dal 2023/24, livello Magistrale): tesi 8 + discussione 2 (=10); premialità carriera MAX +2 in totale tra in corso +1 (qualsiasi sessione), Erasmus +1, volontariato ≥200h +1. Lode a 110 unanime. Corsi di Produzioni Animali (livello Triennale): in corso +3 (1ª/2ª sessione) o +2 (3ª), Erasmus studio +3 / traineeship +2; 30 e lode = 33.",
      en: "Veterinary Medicine (single-cycle LM-42, from 2023/24, 'Master' level here): thesis 8 + discussion 2 (=10); career rewards MAX +2 total among on-time +1 (any session), Erasmus +1, volunteering ≥200h +1. Honors at 110, unanimous. Animal Production programmes ('Bachelor' level): on-time +3 (1st/2nd session) or +2 (3rd), Erasmus study +3 / traineeship +2; 30 cum laude = 33.",
    },
  },
  {
    id: "motorie",
    it: "Scienze Motorie",
    en: "Exercise and Sports Sciences",
    tri: { thesisMax: 8, lode30: 33, inCorso: { estiva: 3, autunnale: 3, invernale: 1 }, erasmus: 1 },
    mag: { thesisMax: 12, lode30: 33, inCorso: { estiva: 0, autunnale: 0, invernale: 0 }, erasmus: 1 },
    src: { url: "https://gov.cdl.unimi.it/sites/lb66/files/2025-03/Attribuzione_punteggi_prove_finali_(v._dic%202024)_1.pdf", date: "25/11/2024" },
    note: {
      it: "30 e lode = 33; media ponderata ×110/30. Tesi: triennale fino a 8, magistrale fino a 12. In corso (SOLO triennale): +3 nella sessione estiva o autunnale del 3° anno, +1 nella invernale. Erasmus/mobilità +1 (tutti i livelli). Magistrale: nessun bonus in corso. Lode a 110 (triennale: automatica se >110; magistrale: su richiesta del relatore).",
      en: "30 cum laude = 33; weighted avg ×110/30. Thesis: bachelor up to 8, master up to 12. On-time (BACHELOR only): +3 in the summer or autumn session of the 3rd year, +1 in the winter one. Erasmus/mobility +1 (all levels). Master: no on-time bonus. Honors at 110 (bachelor: automatic if >110; master: on supervisor's request).",
    },
  },
  {
    id: "mediazione",
    it: "Mediazione Linguistica e Culturale",
    en: "Language Mediation and Intercultural Communication",
    tri: { thesisMax: 3, lode30: 31, inCorso: { estiva: 1, autunnale: 1, invernale: 1 }, erasmus: 0 },
    mag: { thesisMax: 8, lode30: 31, inCorso: { estiva: 0, autunnale: 0, invernale: 0 }, erasmus: 0 },
    src: { url: "https://mediazione.cdl.unimi.it/it/studiare/laurearsi/laurearsi-k21-kab", date: "2026" },
    note: {
      it: "30 e lode = 31; media ponderata ×110/30. Triennale (K21-KAB): tesi 0–3; in corso +1 (entro la durata normale, NON dipende dalla sessione); nessun bonus Erasmus. Lode a 110 + proposta del relatore + ≥1 lode in carriera. Magistrale (LM-38): criteri non pubblicati (valori indicativi) — verifica con il corso.",
      en: "30 cum laude = 31; weighted avg ×110/30. Bachelor (K21-KAB): thesis 0–3; on-time +1 (within normal duration, NOT session-dependent); no Erasmus bonus. Honors at 110 + supervisor's proposal + ≥1 cum laude in career. Master (LM-38): criteria not published (indicative values) — check with the programme.",
    },
  },
];

// Voto "effettivo" di un esame: lode30 = valore del "30 e lode" (33/31/30 per facoltà),
// null se AP/idoneità o voto non valido.
function effectiveVote(e, lode30) {
  if (e.special === "AP") return null;
  if (e.special === "30L") return lode30;
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
  const [session, setSession] = useState("estiva");
  const [erasmus, setErasmus] = useState(false);
  const [bonusExtra, setBonusExtra] = useState("0");
  const [facultyId, setFacultyId] = useState("generica");
  const [level, setLevel] = useState("triennale");
  const [thesis, setThesis] = useState(0);

  // Preset facoltà → punti tesi massimi e valore del "30 e lode" nella media
  const faculty = FACULTIES.find((f) => f.id === facultyId) || FACULTIES[0];
  const preset = level === "magistrale" ? faculty.mag : faculty.tri;
  const lode30 = preset.lode30;
  const thesisMax = preset.thesisMax;

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

  // Se il preset riduce i punti tesi massimi, ridimensiona il valore corrente.
  useEffect(() => {
    setThesis((v) => Math.min(v, thesisMax));
  }, [thesisMax]);

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
      const v = effectiveVote(e, lode30);
      const cfu = parseFloat(e.cfu);
      return v != null && Number.isFinite(cfu) && cfu > 0;
    });
    let weighted = 0;
    let totalCFU = 0;
    for (const e of graded) {
      weighted += effectiveVote(e, lode30) * parseFloat(e.cfu);
      totalCFU += parseFloat(e.cfu);
    }
    const media = totalCFU > 0 ? weighted / totalCFU : 0;
    const base = media * (110 / 30);
    return { examCount: graded.length, totalCFU, media, base };
  }, [exams, lode30]);

  const sessionBonus = session === "fuoricorso" ? 0 : preset.inCorso[session] || 0;
  const erasmusBonus = erasmus ? preset.erasmus : 0;
  const extraBonus = Number.isFinite(parseFloat(bonusExtra))
    ? parseFloat(bonusExtra)
    : 0;
  const bonusTotal = sessionBonus + erasmusBonus + extraBonus;

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
  const SESSION_OPTS = ["estiva", "autunnale", "invernale", "fuoricorso"];

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
          <div
            style={{
              marginTop: 10,
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              color: "#fff",
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.32)",
              borderRadius: 999,
              padding: "5px 12px",
            }}
          >
            ⚠️ {t.disclaimerHeader}
          </div>
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

        {/* ---- Facoltà / regole ---- */}
        <div style={{ ...S.card, marginBottom: 18 }}>
          <h2 style={S.cardTitle}>{t.facultyTitle}</h2>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 280px" }}>
              <label style={S.label} htmlFor="faculty">{t.facultyLabel}</label>
              <select
                id="faculty"
                style={S.input}
                value={facultyId}
                onChange={(ev) => setFacultyId(ev.target.value)}
              >
                {FACULTIES.map((f) => (
                  <option key={f.id} value={f.id}>{lang === "en" ? f.en : f.it}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>{t.levelLabel}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={{ ...S.primaryBtn, background: level === "triennale" ? ACCENT : C.ghostBg, color: level === "triennale" ? "#fff" : C.ghostText, border: "1px solid " + (level === "triennale" ? ACCENT : C.border) }}
                  onClick={() => setLevel("triennale")}
                >
                  {t.triennale}
                </button>
                <button
                  type="button"
                  style={{ ...S.primaryBtn, background: level === "magistrale" ? ACCENT : C.ghostBg, color: level === "magistrale" ? "#fff" : C.ghostText, border: "1px solid " + (level === "magistrale" ? ACCENT : C.border) }}
                  onClick={() => setLevel("magistrale")}
                >
                  {t.magistrale}
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, background: C.panel, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.heading, marginBottom: 6 }}>
              {t.rulesHeading}: {lang === "en" ? faculty.en : faculty.it}
            </div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
              {lang === "en" ? faculty.note.en : faculty.note.it}
            </div>
            {faculty.src && (
              <div style={{ fontSize: 12, marginTop: 8 }}>
                <a href={faculty.src.url} target="_blank" rel="noreferrer" style={{ color: C.accentText, fontWeight: 600 }}>
                  {t.sourceLabel} ↗
                </a>
                <span style={{ color: C.faint }}> · {faculty.src.date}</span>
              </div>
            )}
          </div>
          <p style={{ fontSize: 11, color: C.faint, margin: "10px 0 0" }}>{t.facultyDisclaimer}</p>
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

            {/* Legenda 30L / AP */}
            <div style={{ fontSize: 12, color: C.muted, marginTop: 12, lineHeight: 1.6 }}>
              <span style={{ color: C.accentText, fontWeight: 700 }}>30L</span> {t.legend30L}
              <br />
              <span style={{ color: C.greenText, fontWeight: 700 }}>AP</span> {t.legendAP}
            </div>

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
                  <span style={{ color: C.muted }}>{t.brkInCorso} ({t.sessOpts[session]})</span>
                  <strong style={{ color: C.greenText }}>+{sessionBonus}</strong>
                </div>
              )}
              {erasmusBonus !== 0 && (
                <div style={S.breakLine}>
                  <span style={{ color: C.muted }}>{t.brkErasmus}</span>
                  <strong style={{ color: C.greenText }}>+{erasmusBonus}</strong>
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
                value={session}
                onChange={(ev) => setSession(ev.target.value)}
              >
                {SESSION_OPTS.map((s) => {
                  const pts = s === "fuoricorso" ? 0 : preset.inCorso[s] || 0;
                  return (
                    <option key={s} value={s}>
                      {t.sessOpts[s]}{pts ? ` (+${pts})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <label style={S.checkRow}>
              <input
                type="checkbox"
                checked={erasmus && !!preset.erasmus}
                disabled={!preset.erasmus}
                onChange={(ev) => setErasmus(ev.target.checked)}
                style={{ accentColor: ACCENT, width: 16, height: 16 }}
              />
              {t.erasmusLabel}{" "}
              <span style={{ color: preset.erasmus ? C.greenText : C.faint, fontWeight: 700 }}>
                {preset.erasmus ? `+${preset.erasmus} ${t.pt}` : `(${t.notApplicable})`}
              </span>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.thesisPoints}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: C.accentText }}>
                +{thesis}{" "}
                <span style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>/ {thesisMax}</span>
              </span>
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

        <p style={{ textAlign: "center", color: C.faint, fontSize: 12, margin: "18px 0 10px" }}>
          {t.footer}
        </p>
        <div style={{ textAlign: "center", margin: "0 0 12px" }}>
          <a
            href="mailto:tommaso.belfiori@icloud.com?subject=Calcolatore%20Voto%20di%20Laurea%20UniMi"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13,
              fontWeight: 600,
              color: C.accentText,
              textDecoration: "none",
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              padding: "8px 16px",
            }}
          >
            ✉️ {t.contact}
          </a>
        </div>
      </div>
    </div>
  );
}
