import React, { useState, useMemo, useEffect } from "react";
import { getAppCheckToken } from "./appCheck";

/*
 * Calcolatore Voto di Laurea — Università degli Studi di Milano (UniMi)
 * Valido per tutte le facoltà.
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

// ---------------------------------------------------------------------------
// Palette grado (numero grande + celle scenario)
// ---------------------------------------------------------------------------
function gradeColor(g) {
  if (g >= 103) return "#059669"; // verde
  if (g >= 98) return "#2563eb"; // blu
  if (g >= 93) return "#7c3aed"; // viola
  return "#d97706"; // ambra
}
function cellBg(g) {
  if (g >= 103) return "#bbf7d0";
  if (g >= 98) return "#bfdbfe";
  if (g >= 93) return "#e9d5ff";
  return "#fef9c3";
}
// Sessioni di laurea con relativo bonus
const SESSIONS = [
  { id: "nessuna", label: "Nessuna (0)", pts: 0 },
  { id: "straordinaria", label: "Straordinaria (+1)", pts: 1 },
  { id: "invernale", label: "Invernale (+2)", pts: 2 },
  { id: "primaverile", label: "Primaverile (+2)", pts: 2 },
  { id: "estiva", label: "Estiva (+2)", pts: 2 },
  { id: "autunnale", label: "Autunnale (+3)", pts: 3 },
];

// Fasce qualitative dell'elaborato finale
const THESIS_BANDS = [
  { label: "Sufficiente", range: "0", min: 0 },
  { label: "Discreto", range: "1–2", min: 1 },
  { label: "Buono", range: "3–4", min: 3 },
  { label: "Ottimo", range: "5–6", min: 5 },
  { label: "Eccellente", range: "7–8", min: 7 },
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
// Import automatico della carriera: i file vanno al backend, che custodisce la
// API key e chiama Claude. I visitatori non inseriscono alcuna chiave.
// ---------------------------------------------------------------------------
// Con Firebase Hosting il rewrite /api/extract punta alla Cloud Function
// "extract". In sviluppo puoi puntare all'emulatore via VITE_API_BASE
// (es. VITE_API_BASE=http://127.0.0.1:5000).
const EXTRACT_ENDPOINT =
  (import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "") + "/api/extract";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Impossibile leggere il file."));
    reader.readAsDataURL(file);
  });
}

export default function CalcolatoreVotoLaurea() {
  // ---- Stato ----
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
  // matchMedia rispetta il viewport reale (più affidabile di window.innerWidth).
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

  // ---- Stato import carriera (PDF/screenshot → backend → Claude) ----
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
    setThesis((t) => Math.min(t, max));
  };

  // ---- Estrazione esami dalla carriera ----
  // I file vengono inviati al backend (Cloud Function) che custodisce la API key
  // e chiama Claude con tool use forzato. Il frontend riceve già l'elenco esami.
  const extractExams = async () => {
    setImportError("");
    setImportMsg("");
    if (!files.length) {
      setImportError("Carica almeno un PDF o uno screenshot della carriera.");
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
      if (!payload.length) {
        throw new Error("Formato file non supportato: usa PDF o immagini.");
      }
      if (totalBytes > 12_000_000) {
        throw new Error(
          "File troppo grandi (max ~9 MB totali). Carica meno pagine o riduci la risoluzione."
        );
      }

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
      if (!Array.isArray(esami) || !esami.length) {
        throw new Error("Nessun esame riconosciuto nel documento.");
      }

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
          // Scarta righe prive sia di voto/AP/30L valido sia di CFU
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

      if (!imported.length) {
        throw new Error("Nessun esame valido estratto.");
      }
      setExams(imported);
      setImportMsg(
        `Importati ${imported.length} esami. Controlla e correggi eventuali errori.`
      );
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

  // Lode raggiungibile: massimo teorico (bonus correnti + tesi al massimo)
  const maxLordo = calc.base + bonusTotal + thesisMax;
  const maxFinal = Math.round(maxLordo);
  const lodeReachable = hasExams && maxFinal > 110;

  // Tabella scenari (per punti tesi)
  const scenarios = useMemo(() => {
    const rows = [];
    for (let t = 0; t <= thesisMax; t++) {
      const l = calc.base + bonusTotal + t;
      const f = Math.round(l);
      rows.push({ t, final: f, lode: f > 110, display: Math.min(f, 110) });
    }
    return rows;
  }, [calc.base, bonusTotal, thesisMax]);

  const bands = THESIS_BANDS.filter((b) => b.min <= thesisMax);

  // ---- Stili ----
  const S = {
    page: {
      minHeight: "100vh",
      background: "#f3f0ff",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#1f2937",
      padding: isMobile ? "12px" : "24px",
      boxSizing: "border-box",
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
    card: {
      background: "#fff",
      borderRadius: 14,
      boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
      padding: isMobile ? "16px" : "20px",
    },
    cardTitle: {
      margin: "0 0 14px",
      fontSize: 16,
      fontWeight: 700,
      color: "#1e1b4b",
    },
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
      color: "#6b7280",
      padding: "6px 8px",
      fontWeight: 700,
    },
    td: { padding: "5px 8px", verticalAlign: "middle" },
    input: {
      width: "100%",
      padding: "8px 10px",
      border: "1px solid #d1d5db",
      borderRadius: 8,
      fontSize: 14,
      boxSizing: "border-box",
      fontFamily: "inherit",
    },
    smallInput: {
      width: "100%",
      padding: "8px 8px",
      border: "1px solid #d1d5db",
      borderRadius: 8,
      fontSize: 14,
      boxSizing: "border-box",
      textAlign: "center",
      fontFamily: "inherit",
    },
    addBtn: {
      marginTop: 12,
      background: "#4338ca",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "10px 16px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
    },
    primaryBtn: {
      background: "#4338ca",
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
      borderTop: "1px solid #eee",
    },
    totalBox: { flex: "1 1 110px", minWidth: 100 },
    totalLabel: { fontSize: 12, color: "#6b7280", marginBottom: 2 },
    totalVal: { fontSize: 18, fontWeight: 700, color: "#1e1b4b" },
    field: { marginBottom: 14 },
    label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 },
    checkRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 0",
      fontSize: 14,
    },
    range: { width: "100%", accentColor: "#4338ca", marginTop: 6 },
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
      background: ok ? "#dcfce7" : "#fee2e2",
      color: ok ? "#16a34a" : "#dc2626",
      border: `1px solid ${ok ? "#86efac" : "#fca5a5"}`,
    }),
  };

  const toggleBtn = (active, accent) => ({
    border: `1px solid ${active ? accent : "#d1d5db"}`,
    background: active ? accent : "#fff",
    color: active ? "#fff" : "#374151",
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    minWidth: 38,
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
          <h1 style={S.headerTitle}>Calcolatore Voto di Laurea</h1>
          <p style={S.headerSub}>
            Università degli Studi di Milano · valido per tutte le facoltà
          </p>
        </div>

        {/* ---- Import carriera (PDF/screenshot → Claude) ---- */}
        <div style={{ ...S.card, marginBottom: 18 }}>
          <h2 style={S.cardTitle}>Importa la tua carriera (PDF o screenshot)</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
            Carica la scheda “carriera” (da SIFA / UNIMIA): Claude legge il documento
            e compila automaticamente la tabella degli esami, così non devi inserirli
            a mano uno a uno.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 260px" }}>
              <label style={S.label}>File (PDF o immagini, anche più di uno)</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(ev) => {
                  setFiles(Array.from(ev.target.files || []));
                  setImportError("");
                  setImportMsg("");
                }}
                style={{ width: "100%", fontSize: 13 }}
              />
              {files.length > 0 && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                  {files.length} file selezionati
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
              {importing ? "Estrazione in corso…" : "Estrai esami"}
            </button>
          </div>

          {importError && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fee2e2",
                color: "#b91c1c",
                fontSize: 13,
                border: "1px solid #fca5a5",
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
                background: "#dcfce7",
                color: "#15803d",
                fontSize: 13,
                border: "1px solid #86efac",
              }}
            >
              ✓ {importMsg}
            </div>
          )}

          <p style={{ fontSize: 11, color: "#9ca3af", margin: "12px 0 0" }}>
            I file vengono inviati al nostro server, che li elabora con l'intelligenza
            artificiale e li scarta subito dopo: nessun dato viene salvato. Controlla
            sempre gli esami importati prima di affidarti al calcolo.
          </p>
        </div>

        {/* ---- Tabella esami + Risultato ---- */}
        <div style={S.grid2}>
          {/* Tabella esami */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>Esami sostenuti</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                <thead>
                  <tr>
                    <th style={S.th}>Nome esame</th>
                    <th style={{ ...S.th, width: 170 }}>Voto</th>
                    <th style={{ ...S.th, width: 80 }}>CFU</th>
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
                            placeholder="(facoltativo)"
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
                              style={toggleBtn(is30L, "#4338ca")}
                              onClick={() => toggleSpecial(e.id, "30L")}
                              title="30 e Lode (vale 33)"
                            >
                              30L
                            </button>
                            <button
                              type="button"
                              style={toggleBtn(isAP, "#16a34a")}
                              onClick={() => toggleSpecial(e.id, "AP")}
                              title="Idoneità / Altre attività — escluso dalla media"
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
                            aria-label="Rimuovi esame"
                            onClick={() => removeExam(e.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#9ca3af",
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
              + Aggiungi esame
            </button>

            {/* Totali in tempo reale */}
            <div style={S.totalsRow}>
              <div style={S.totalBox}>
                <div style={S.totalLabel}>Esami (no AP)</div>
                <div style={S.totalVal}>{calc.examCount}</div>
              </div>
              <div style={S.totalBox}>
                <div style={S.totalLabel}>CFU totali</div>
                <div style={S.totalVal}>
                  {Number.isInteger(calc.totalCFU)
                    ? calc.totalCFU
                    : calc.totalCFU.toFixed(1)}
                </div>
              </div>
              <div style={S.totalBox}>
                <div style={S.totalLabel}>Media ponderata</div>
                <div style={S.totalVal}>{hasExams ? calc.media.toFixed(4) : "—"}</div>
              </div>
              <div style={S.totalBox}>
                <div style={S.totalLabel}>Punteggio base</div>
                <div style={S.totalVal}>{hasExams ? calc.base.toFixed(3) : "—"}</div>
              </div>
            </div>
          </div>

          {/* Risultato */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>Voto finale</h2>
            <div style={{ textAlign: "center", padding: "6px 0 10px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize: isMobile ? 56 : 68, fontWeight: 800, lineHeight: 1, color: hasExams ? gradeColor(finalGrade) : "#9ca3af" }}>
                  {hasExams ? displayGrade : "–"}
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#9ca3af" }}>/110</span>
              </div>
              {hasExams && isLode && (
                <div style={{ marginTop: 6, fontWeight: 800, color: "#059669", fontSize: 18 }}>
                  e Lode 🎓
                </div>
              )}
              {!hasExams && (
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700, color: "#9ca3af" }}>
                  Inserisci gli esami
                </div>
              )}
            </div>

            {/* Dettaglio calcolo */}
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
              <div style={S.breakLine}>
                <span style={{ color: "#6b7280" }}>Media ponderata</span>
                <strong>{hasExams ? calc.media.toFixed(4) : "—"} / 30</strong>
              </div>
              <div style={S.breakLine}>
                <span style={{ color: "#6b7280" }}>Punteggio base</span>
                <strong>{hasExams ? calc.base.toFixed(3) : "—"} / 110</strong>
              </div>
              {sessionBonus !== 0 && (
                <div style={S.breakLine}>
                  <span style={{ color: "#6b7280" }}>+ Sessione {session.label.replace(/\s*\(.*\)/, "")}</span>
                  <strong style={{ color: "#16a34a" }}>+{sessionBonus}</strong>
                </div>
              )}
              {erasmusBonus !== 0 && (
                <div style={S.breakLine}>
                  <span style={{ color: "#6b7280" }}>+ Erasmus / Mobilità</span>
                  <strong style={{ color: "#16a34a" }}>+{erasmusBonus}</strong>
                </div>
              )}
              {laureandoBonus !== 0 && (
                <div style={S.breakLine}>
                  <span style={{ color: "#6b7280" }}>+ Laureando in corso</span>
                  <strong style={{ color: "#16a34a" }}>+{laureandoBonus}</strong>
                </div>
              )}
              {extraBonus !== 0 && (
                <div style={S.breakLine}>
                  <span style={{ color: "#6b7280" }}>+ Bonus aggiuntivo</span>
                  <strong style={{ color: "#16a34a" }}>{extraBonus > 0 ? "+" : ""}{extraBonus}</strong>
                </div>
              )}
              <div style={S.breakLine}>
                <span style={{ color: "#6b7280" }}>+ Elaborato finale</span>
                <strong style={{ color: "#16a34a" }}>+{thesis} pt</strong>
              </div>
              <div style={{ ...S.breakLine, borderTop: "1px solid #e5e7eb", marginTop: 6, paddingTop: 8 }}>
                <span style={{ color: "#6b7280" }}>Lordo</span>
                <span>
                  <strong>{hasExams ? lordo.toFixed(3) : "—"}</strong>{" "}
                  <span style={{ color: "#9ca3af" }}>→</span>{" "}
                  <strong style={{ color: hasExams ? gradeColor(finalGrade) : "#9ca3af" }}>
                    {hasExams ? (isLode ? "110 e Lode" : finalGrade) : "—"} / 110
                  </strong>
                </span>
              </div>
            </div>

            {/* Badge lode */}
            <div style={S.badge(lodeReachable)}>
              {lodeReachable ? "✓ Lode raggiungibile" : "✗ Lode non raggiungibile"}
              <span style={{ fontWeight: 500, opacity: 0.85 }}>
                (max teorico: {hasExams ? maxFinal : "—"})
              </span>
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "8px 0 0" }}>
              La lode è assegnata con voto unanime della commissione.
            </p>
          </div>
        </div>

        {/* ---- Bonus + Elaborato ---- */}
        <div style={S.grid2eq}>
          {/* Bonus */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>Bonus</h2>
            <div style={S.field}>
              <label style={S.label} htmlFor="sessione">Sessione di laurea</label>
              <select
                id="sessione"
                style={S.input}
                value={sessionId}
                onChange={(ev) => setSessionId(ev.target.value)}
              >
                {SESSIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <label style={S.checkRow}>
              <input type="checkbox" checked={erasmus} onChange={(ev) => setErasmus(ev.target.checked)} style={{ accentColor: "#4338ca", width: 16, height: 16 }} />
              Erasmus / Mobilità internazionale <span style={{ color: "#16a34a", fontWeight: 700 }}>+2 pt</span>
            </label>
            <label style={S.checkRow}>
              <input type="checkbox" checked={laureando} onChange={(ev) => setLaureando(ev.target.checked)} style={{ accentColor: "#4338ca", width: 16, height: 16 }} />
              Laureando in corso (nei tempi previsti) <span style={{ color: "#16a34a", fontWeight: 700 }}>+1 pt</span>
            </label>

            <div style={{ ...S.field, marginTop: 12 }}>
              <label style={S.label} htmlFor="bonusExtra">Bonus aggiuntivo (specifico per facoltà)</label>
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
            <h2 style={S.cardTitle}>Elaborato finale</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                style={{ ...S.primaryBtn, flex: 1, background: thesisMax === 6 ? "#4338ca" : "#fff", color: thesisMax === 6 ? "#fff" : "#374151", border: "1px solid " + (thesisMax === 6 ? "#4338ca" : "#d1d5db") }}
                onClick={() => setThesisMaxAndClamp(6)}
              >
                Max 6 (Triennale)
              </button>
              <button
                type="button"
                style={{ ...S.primaryBtn, flex: 1, background: thesisMax === 8 ? "#4338ca" : "#fff", color: thesisMax === 8 ? "#fff" : "#374151", border: "1px solid " + (thesisMax === 8 ? "#4338ca" : "#d1d5db") }}
                onClick={() => setThesisMaxAndClamp(8)}
              >
                Max 8 (Magistrale)
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Punti elaborato</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#4338ca" }}>+{thesis}</span>
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
                <div key={b.label} style={{ textAlign: "center", flex: "1 1 0", minWidth: 60 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#4338ca" }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>({b.range})</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Tabella scenari ---- */}
        <div style={S.card}>
          <h2 style={S.cardTitle}>Scenari per punti elaborato</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={S.th}>Punti elaborato</th>
                  <th style={{ ...S.th, textAlign: "center" }}>Voto finale</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((row) => {
                  const selected = row.t === thesis;
                  return (
                    <tr key={row.t}>
                      <td style={{ ...S.td, fontWeight: selected ? 800 : 500, color: selected ? "#1e1b4b" : "#374151" }}>
                        {selected && <span style={{ color: "#4338ca", marginRight: 6 }}>▶</span>}
                        +{row.t} pt
                        {row.t === thesisMax && <span style={{ color: "#9ca3af", fontWeight: 400 }}> (max)</span>}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            minWidth: 96,
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontWeight: 800,
                            background: hasExams ? cellBg(row.final) : "#f3f4f6",
                            color: hasExams ? gradeColor(row.final) : "#9ca3af",
                            outline: selected ? "2px solid #4338ca" : "none",
                            outlineOffset: -2,
                          }}
                        >
                          {hasExams ? (row.lode ? "110 e Lode" : row.display) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, margin: "18px 0 8px" }}>
          Strumento indicativo. Le regole esatte (bonus, soglie, lode) variano per
          corso di laurea: verifica sempre il regolamento del tuo dipartimento.
        </p>
      </div>
    </div>
  );
}
