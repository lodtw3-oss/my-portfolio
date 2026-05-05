import React, { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from "recharts";
import AnalysisChart from "./components/AnalysisChart.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";

// ??? 1. 閮剖??見撘??????????????????????????????????????????????????????
const COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fb923c", "#f472b6", "#facc15", "#a78bfa", "#2dd4bf"];
const TAIPEI_TZ = "Asia/Taipei";

const S = {
  app: { width: "100vw", minHeight: "100vh", background: "#050a14", color: "#dde3f0", fontFamily: "'Noto Sans TC', sans-serif", display: "flex", flexDirection: "column", margin: 0, padding: 0, overflowX: "hidden" },
  header: { background: "#0b1629", borderBottom: "1px solid #1a3050", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  appFont: { fontSize: '14px' },
  logo: { fontSize: "1.2rem", fontWeight: 800, color: "#38bdf8", letterSpacing: "1px" },
  nav: { display: "flex", gap: "2px", background: "#0b1629", padding: "0 24px" },
  navBtn: (a) => ({ padding: "16px 24px", border: "none", background: a ? "#050a14" : "transparent", color: a ? "#38bdf8" : "#475569", cursor: "pointer", fontWeight: 700, transition: "0.2s", borderTop: a ? "3px solid #38bdf8" : "3px solid transparent" }),
  content: { padding: "24px", flex: 1 },
  card: { background: "#0c1a2e", border: "1px solid #1a3050", borderRadius: 10, padding: 12, marginBottom: 12 },
  input: { background: "#07111e", border: "1px solid #1a3050", borderRadius: 6, color: "#dde3f0", padding: "10px", width: "100%", boxSizing: "border-box" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", marginTop: 15, tableLayout: "auto" },
  th: { textAlign: "left", padding: "6px", color: "#4a6080", borderBottom: "1px solid #1a3050", fontSize: "0.72rem" },
  td: { padding: "6px", borderBottom: "1px solid #0b1629", fontSize: '0.9rem' },
  
  btn: (v) => ({ padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 700, background: v === "primary" ? "#0ea5e9" : v === "danger" ? "#ef4444" : "#1e293b", color: "#fff" }),
  gapBadge: (gap) => ({ padding: "2px 6px", borderRadius: 4, fontSize: "0.75rem", background: gap > 0 ? "#10b98133" : gap < 0 ? "#ef444433" : "transparent", color: gap > 0 ? "#10b981" : gap < 0 ? "#ef4444" : "#94a3b8", fontWeight: "bold" })
};

// ??? 2. 撌亙?賢? ???????????????????????????????????????????????????????
const fmt = (v, d = 0) => new Intl.NumberFormat("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

const ymdInTaipei = (dateLike) =>
  new Date(dateLike).toLocaleString("sv-SE", { timeZone: TAIPEI_TZ }).split(" ")[0];

const isLocalDevHost = () => {
  if (typeof window === "undefined" || !window?.location?.hostname) return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
};

async function fetchFinanceData(symbol, market, targetDate) {
  const clean = symbol.trim().toUpperCase();
  try {
    // Use local proxy to avoid browser CORS and protect API keys.
    const base = isLocalDevHost() ? "http://localhost:4000" : "";
    const query = new URLSearchParams({
      symbol: clean,
      market: market || "US",
    });
    if (targetDate) query.set("date", targetDate);
    const url = `${base}/api/quote?${query.toString()}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data) return null;
    if (data.price !== undefined && data.price !== null) {
      return { price: data.price, change: data.change, asOfDate: data.asOfDate || targetDate || null };
    }
    // fallback if proxy returns raw Yahoo result
    const meta = data.raw?.chart?.result?.[0]?.meta;
    if (meta) {
      return {
        price: meta.regularMarketPrice,
        change: ((meta.regularMarketPrice - meta.chartPreviousClose) / (meta.chartPreviousClose || 1)) * 100,
        asOfDate: targetDate || null,
      };
    }
    return null;
  } catch { return null; }
}

// ??? 3. 銝餌?撘??????????????????????????????????????????????????????????
export default function App() {
  const [portfolios, setPortfolios] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("portfolios");
  const [usdtwd, setUsdtwd] = useState(32.5);
  const [loading, setLoading] = useState(false);
  const [expandedAll, setExpandedAll] = useState(false);

  const [pName, setPName] = useState("");
  const [tempEntries, setTempEntries] = useState([]);
  const [entry, setEntry] = useState({ type: "TW", symbol: "", shares: "", cash: "", targetPct: "0" });
  const [analysisConfig, setAnalysisConfig] = useState({ gran: "day", target: "total" });
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingPortfolio, setEditingPortfolio] = useState(null);
  const [editingSnapshot, setEditingSnapshot] = useState(null);
  const [lastRetentionDate, setLastRetentionDate] = useState(null);

  // 撱箇?敹怎嚗?誑?啣????箸?嚗?
  const buildSnapshotFromPortfolios = (pArray, tsOverride) => {
    const tsNow = tsOverride || new Date().toISOString();
    const date = ymdInTaipei(tsNow);
    const breakdown = (pArray || []).map(p => ({
      id: p.id,
      name: p.name,
      value: p.totalTWD || 0,
      entries: (p.entries || []).map(e => ({
        id: e.id,
        symbol: e.symbol,
        type: e.type,
        shares: e.shares,
        currentPrice: e.currentPrice,
        change: e.change,
        valueTWD: e.valueTWD,
        targetPct: e.targetPct
      }))
    }));
    const total = breakdown.reduce((s, x) => s + (x.value || 0), 0);
    return { date, ts: tsNow, value: total, breakdown };
  };

  const cloneSnapshotBreakdown = (snapshot) =>
    (snapshot?.breakdown || []).map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      value: portfolio.value || 0,
      entries: (portfolio.entries || []).map((entryItem) => ({
        id: entryItem.id,
        symbol: entryItem.symbol,
        type: entryItem.type,
        shares: entryItem.shares,
        currentPrice: entryItem.currentPrice,
        change: entryItem.change,
        valueTWD: entryItem.valueTWD,
        targetPct: entryItem.targetPct,
      })),
    }));

  const createSnapshotForDate = async (targetDate) => {
    const historyLocal = JSON.parse(localStorage.getItem("v6_h") || "[]");
    const normalizedHistory = Array.isArray(historyLocal) ? historyLocal : [];
    const previousDay = new Date(`${targetDate}T00:00:00+08:00`);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDate = previousDay.toLocaleDateString("en-CA", { timeZone: TAIPEI_TZ });

    const sortedHistory = normalizedHistory
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.ts || `${a.date}T12:00:00+08:00`).getTime();
        const tb = new Date(b.ts || `${b.date}T12:00:00+08:00`).getTime();
        return tb - ta;
      });

    const sourceSnapshot =
      sortedHistory.find((item) => item.date === previousDate) ||
      sortedHistory.find((item) => item.date < targetDate);

    if (!sourceSnapshot?.breakdown?.length) {
      throw new Error("找不到指定日期前可沿用的歷史快照");
    }

    const sameDateSnapshots = normalizedHistory
      .filter((item) => item.date === targetDate)
      .map((item) => new Date(item.ts || `${item.date}T14:00:00+08:00`).getTime())
      .filter((time) => !Number.isNaN(time))
      .sort((a, b) => a - b);

    const baseSnapshotTime = new Date(`${targetDate}T14:00:00+08:00`).getTime();
    const latestSnapshotTime =
      sameDateSnapshots.length > 0 ? sameDateSnapshots[sameDateSnapshots.length - 1] + 60 * 1000 : baseSnapshotTime;
    const snapshotTime = new Date(latestSnapshotTime).toISOString();
    const breakdown = await Promise.all(
      cloneSnapshotBreakdown(sourceSnapshot).map(async (portfolio) => {
        const entries = await Promise.all(
          (portfolio.entries || []).map(async (entryItem) => {
            if (entryItem.type === "cash" || !entryItem.symbol || entryItem.symbol === "CASH") {
              const cashValue = Number(entryItem.valueTWD ?? entryItem.shares ?? 0);
              return {
                ...entryItem,
                currentPrice: 1,
                change: 0,
                valueTWD: cashValue,
              };
            }

            const quote = await fetchFinanceData(entryItem.symbol, entryItem.type, targetDate);
            if (quote?.asOfDate && quote.asOfDate !== targetDate) {
              throw new Error(entryItem.symbol + " 找不到 " + targetDate + " 的收盤價。");
            }
            const price = Number(quote?.price ?? entryItem.currentPrice ?? 0);
            const change = Number(quote?.change ?? entryItem.change ?? 0);
            const shares = Number(entryItem.shares || 0);
            const rate = entryItem.type === "US" ? usdtwd : 1;

            return {
              ...entryItem,
              currentPrice: price,
              change,
              valueTWD: Number((shares * price * rate).toFixed(2)),
            };
          })
        );

        const value = entries.reduce((sum, entryItem) => sum + Number(entryItem.valueTWD || 0), 0);
        return { ...portfolio, entries, value };
      })
    );

    const value = breakdown.reduce((sum, portfolio) => sum + Number(portfolio.value || 0), 0);
    return {
      date: targetDate,
      ts: snapshotTime,
      value,
      breakdown,
    };
  };
  useEffect(() => {
    const p = localStorage.getItem("v6_p");
    const h = localStorage.getItem("v6_h");
    if (p) {
      try {
        const parsed = JSON.parse(p);
        const normalized = (parsed || []).map((x, i) => ({
          ...x,
          id: x.id ?? `${Date.now()}-${i}-${Math.floor(Math.random()*10000)}`
        }));
        setPortfolios(normalized);
      } catch { setPortfolios(JSON.parse(p)); }
    }
    if (h) setHistory(JSON.parse(h));

    fetch("https://open.er-api.com/v6/latest/USD").then(r => r.json()).then(d => setUsdtwd(d.rates.TWD));

    // Auto-create daily snapshots at 14:00 and run retention at 00:00 Taipei time
    const timer = setInterval(() => {
      const now = Date.now();
      // Taipei time = UTC +8
      const taipeiNow = new Date(now + 8 * 3600000);
      const th = taipeiNow.getUTCHours();
      const tm = taipeiNow.getUTCMinutes();
      const taipeiDateStr = taipeiNow.toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).split(' ')[0];

      // Create a daily snapshot at 14:00 Taipei time
      // ??localStorage 閮?嚗??銴孛?潘?銝血捆??tm=0~2嚗??setInterval 瞍宏/?蝭瘚?暺?
      if (th === 14 && tm <= 2) {
        const lastAuto = localStorage.getItem('v6_last_auto_snapshot_date') || '';
        if (lastAuto !== taipeiDateStr) {
          localStorage.setItem('v6_last_auto_snapshot_date', taipeiDateStr);
          (async () => {
            try {
              await manualRefresh(); // ????啣???
              const pLocalNow = JSON.parse(localStorage.getItem("v6_p") || "[]");
              const snap = buildSnapshotFromPortfolios(pLocalNow);
              const hLocal = JSON.parse(localStorage.getItem("v6_h") || "[]");
              const newH = [...hLocal, snap];
              setHistory(newH);
              localStorage.setItem("v6_h", JSON.stringify(newH));
              exportDailySnapshotCSV(snap);
            } catch (e) {
              console.error('auto snapshot error', e);
              // ?亙仃??霈?憭拚????銝????岫
              localStorage.removeItem('v6_last_auto_snapshot_date');
            }
          })();
        }
      }

      // 瘥?啣? 00:00 ?瑁?靽?蝑嚗?瑁?銝甈∴?
      const taipeiDateStrIso = taipeiNow.toISOString().split('T')[0];
      if (th === 0 && tm === 0 && lastRetentionDate !== taipeiDateStrIso) {
        // prev date (???????)
        const prevDate = new Date(now + 8 * 3600000 - 24 * 3600000);
        const prevDateStr = prevDate.toISOString().split('T')[0];
        const hLocal = JSON.parse(localStorage.getItem('v6_h') || '[]');
        // window: prevDate 14:00 ~ 21:00 (Taipei)
        const winStart = new Date(prevDateStr + 'T14:00:00+08:00').getTime();
        const winEnd = new Date(prevDateStr + 'T21:00:00+08:00').getTime();
        // find latest snapshot within window
        let candidate = null;
        (hLocal || []).forEach(h => {
          const ts = h.ts ? new Date(h.ts).getTime() : (new Date((h.date || '') + 'T00:00:00+08:00').getTime());
          if (!isNaN(ts) && ts >= winStart && ts <= winEnd) {
            if (!candidate || ts > (new Date(candidate.ts).getTime())) candidate = h;
          }
        });
        let newH = [...hLocal];
        const hasForPrev = (hLocal || []).some(h => h.date === prevDateStr);
        if (!hasForPrev) {
          if (candidate) {
            // append the found snapshot (ensure date preserved)
            newH.push(candidate);
          } else {
            // no candidate: build a snapshot from current portfolios but mark date as prevDate
            const snap = buildSnapshotFromPortfolios(JSON.parse(localStorage.getItem('v6_p') || '[]'));
            // set ts to prevDate 23:59:59 Taipei converted to ISO
            const tsObj = new Date(prevDateStr + 'T23:59:59+08:00');
            snap.date = prevDateStr;
            snap.ts = tsObj.toISOString();
            newH.push(snap);
          }
          setHistory(newH);
          localStorage.setItem('v6_h', JSON.stringify(newH));
        }
        setLastRetentionDate(taipeiDateStrIso);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [lastRetentionDate]);

  const save = (newP) => {
    setPortfolios(newP);
    localStorage.setItem("v6_p", JSON.stringify(newP));
  };

  // --- CSV helpers -------------------------------------------------
  const toCSV = (rows, headers) => {
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const head = headers.join(',');
    const body = rows.map(r => headers.map(h => esc(r[h] ?? '')).join(',')).join('\n');
    return head + '\n' + body;
  };

  const downloadCSV = async (filename, content) => {
    try {
      // ????身?交?嚗???箔??伐??啣?嚗????亦蝯??亙?銝撟游??拇?蝝?
      const base = (typeof window !== 'undefined' && window && window.location && window.location.hostname === 'localhost') ? 'http://localhost:4000' : '';
      const response = await fetch(`${base}/api/save-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, content }),
      });

      if (response.ok) {
        console.log(`CSV saved to record folder: ${filename}`);
        alert(`CSV 已儲存到 record 資料夾：${filename}`);
      } else {
        console.error('Failed to save CSV to server');
        // fallback: download CSV directly in the browser
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        alert(`無法連線到伺服器，已改為直接下載 CSV：${filename}`);
      }
    } catch (e) {
      console.error('Error saving CSV:', e);
      // fallback: download CSV directly in the browser
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      alert(`CSV 匯出完成：${filename}`);
    }
  };

  const exportPortfoliosCSV = () => {
    const rows = (portfolios || []).map(p => ({ id: p.id, name: p.name, totalTWD: p.totalTWD || 0 }));
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const csv = toCSV(rows, ['id','name','totalTWD']);
    downloadCSV(`portfolios_${ts}.csv`, csv);
    // also export entries as separate file
    const entriesRows = [];
    (portfolios || []).forEach(p => {
      (p.entries || []).forEach(en => {
        entriesRows.push({ portfolioId: p.id, portfolioName: p.name, id: en.id, symbol: en.symbol, type: en.type, shares: en.shares, currentPrice: en.currentPrice, change: en.change, valueTWD: en.valueTWD, targetPct: en.targetPct });
      });
    });
    if (entriesRows.length > 0) {
      const entriesCsv = toCSV(entriesRows, ['portfolioId','portfolioName','id','symbol','type','shares','currentPrice','change','valueTWD','targetPct']);
      downloadCSV(`entries_${ts}.csv`, entriesCsv);
    }
  };

  const exportHistoryCSV = () => {
    const rows = (history || []).map(h => ({
      date: h.date,
      ts: h.ts,
      value: h.value,
      breakdown: JSON.stringify(h.breakdown || [])
    }));
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const csv = toCSV(rows, ['date','ts','value','breakdown']);
    downloadCSV(`snapshots_${ts}.csv`, csv);
  };

  // ?臬瘥敹怎 CSV嚗?頛?祆?嚗?
  const exportDailySnapshotCSV = (snap) => {
    if (!snap) return;
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const filename = `daily_snapshot_${snap.date}_${ts}.csv`;
    
    // 蝚砌???蝮質汗
    const rows = [{
      date: snap.date,
      timestamp: snap.ts,
      totalValue: snap.value,
      portfolioCount: (snap.breakdown || []).length
    }];
    
    // 敺???蝯???蝝堆?靘?撅?嚗?
    (snap.breakdown || []).forEach(p => {
      rows.push({
        portfolioId: p.id,
        portfolioName: p.name,
        portfolioValue: p.value,
        entryCount: (p.entries || []).length
      });
      
      // ?敦??瘥???
      (p.entries || []).forEach(e => {
        rows.push({
          entryId: e.id,
          symbol: e.symbol,
          type: e.type,
          shares: e.shares,
          currentPrice: e.currentPrice,
          change: e.change,
          valueTWD: e.valueTWD,
          targetPct: e.targetPct
        });
      });
    });
    
    const csv = toCSV(rows, ['date','timestamp','totalValue','portfolioCount','portfolioId','portfolioName','portfolioValue','entryCount','entryId','symbol','type','shares','currentPrice','change','valueTWD','targetPct']);
    downloadCSV(filename, csv);
  };

  const parseCSV = (text) => {
    const rows = [];
    let i = 0;
    const len = text.length;
    const nextCell = () => {
      if (i >= len) return null;
      if (text[i] === '"') {
        i++;
        let s = '';
        while (i < len) {
          if (text[i] === '"') {
            if (text[i+1] === '"') { s += '"'; i += 2; continue; }
            i++; break;
          }
          s += text[i++];
        }
        if (text[i] === ',') i++;
        return s;
      }
      let s = '';
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') s += text[i++];
      if (text[i] === ',') i++;
      return s.trim();
    };
    // read header
    const headerCells = [];
    // simple header parse until newline
    while (i < len && text[i] !== '\n' && text[i] !== '\r') {
      const c = nextCell();
      if (c === null) break;
      headerCells.push(c);
    }
    // skip potential \r\n
    if (text[i] === '\r') i++; if (text[i] === '\n') i++;
    while (i < len) {
      const obj = {};
      for (let hi=0; hi<headerCells.length; hi++) {
        const v = nextCell();
        obj[headerCells[hi]] = v === null ? '' : v;
        // handle newline markers
        if (text[i] === '\r') i++; if (text[i] === '\n') i++;
      }
      rows.push(obj);
    }
    return rows;
  };

  const handleImportPortfoliosFile = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseCSV(text);
        if (!parsed || parsed.length === 0) throw new Error('empty');
        const headers = Object.keys(parsed[0]).map(h => h.trim().toLowerCase());
        let newPortfolios = [];
        if (headers.includes('symbol') || headers.includes('portfolioid') || headers.includes('portfolio')) {
          // treat as per-entry CSV: group by portfolioId or portfolioName
          const groups = {};
          parsed.forEach((r, idx) => {
            const pidRaw = r.portfolioid || r.portfolio || r.portfolioname || '';
            const pid = pidRaw && pidRaw !== '' ? String(pidRaw).trim() : `import-${String(r.portfolioname||'p').trim() || 'p'}-${Math.floor(idx/1000)}`;
            if (!groups[pid]) groups[pid] = { id: pid, name: r.portfolioname || `Imported ${pid}`, entries: [] };
            const en = {
              id: r.id || `${pid}-e-${idx}`,
              symbol: r.symbol || r.ticker || r.code || '',
              type: r.type || 'TW',
              shares: Number(r.shares) || 0,
              currentPrice: Number(r.currentPrice) || 0,
              change: Number(r.change) || 0,
              valueTWD: Number(r.valueTWD) || 0,
              targetPct: Number(r.targetPct) || 0
            };
            groups[pid].entries.push(en);
          });
          newPortfolios = Object.keys(groups).map(k => ({ id: groups[k].id, name: groups[k].name, entries: groups[k].entries, totalTWD: groups[k].entries.reduce((s,x)=>s + (Number(x.valueTWD)||0),0) }));
        } else if (headers.includes('entries')) {
          // original format: one portfolio per row with entries JSON
          newPortfolios = parsed.map((r, idx) => {
            const entries = (() => { try { return JSON.parse(r.entries || '[]'); } catch { return []; }})();
            const pid = r.id && r.id !== '' ? r.id : `${Date.now()}-${idx}`;
            const ensuredEntries = (entries || []).map((en, ei) => ({ id: en.id || `${pid}-e-${ei}`, symbol: en.symbol, shares: en.shares, type: en.type || 'TW', currentPrice: en.currentPrice, change: en.change, valueTWD: en.valueTWD, targetPct: en.targetPct }));
            const total = Number(r.totalTWD) || ensuredEntries.reduce((s,x)=>s + (Number(x.valueTWD)||0), 0);
            return { id: pid, name: r.name || `Imported ${idx+1}`, entries: ensuredEntries, totalTWD: total };
          });
        } else {
          throw new Error('unknown format');
        }
        save(newPortfolios);
        setTab('portfolios');
        alert('匯入成功。');
      } catch { alert('匯入失敗，請檢查 CSV 格式。'); }
      // reset input
      ev.target.value = '';
    };
    reader.readAsText(f, 'utf-8');
  };

  const handleImportHistoryFile = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseCSV(text);
        if (!parsed || parsed.length === 0) throw new Error('empty');

        const importedHistory = parsed.map((row, index) => {
          const breakdown = (() => {
            try {
              return JSON.parse(row.breakdown || '[]');
            } catch {
              return [];
            }
          })();

          const date = (row.date || '').trim();
          const ts = (row.ts || '').trim();
          const value = Number(row.value) || 0;
          if (!date) throw new Error(`row ${index + 1} missing date`);

          return {
            date,
            ts: ts || new Date(`${date}T14:00:00+08:00`).toISOString(),
            value,
            breakdown: Array.isArray(breakdown) ? breakdown : [],
          };
        });

        const existingHistory = JSON.parse(localStorage.getItem("v6_h") || "[]");
        const mergedHistoryMap = new Map();
        [...(Array.isArray(existingHistory) ? existingHistory : []), ...importedHistory].forEach((item) => {
          const dedupeKey = `${item.date}__${item.ts || ""}`;
          if (!mergedHistoryMap.has(dedupeKey)) {
            mergedHistoryMap.set(dedupeKey, item);
          }
        });

        const mergedHistory = Array.from(mergedHistoryMap.values()).sort((a, b) =>
          new Date(a.ts || `${a.date}T12:00:00+08:00`).getTime() -
          new Date(b.ts || `${b.date}T12:00:00+08:00`).getTime()
        );

        setHistory(mergedHistory);
        localStorage.setItem("v6_h", JSON.stringify(mergedHistory));
        setExpandedHistory(null);
        setTab('history');
        alert('歷史紀錄匯入成功。');
      } catch {
        alert('歷史紀錄匯入失敗，請確認 CSV 格式是否正確。');
      }
      ev.target.value = '';
    };
    reader.readAsText(f, 'utf-8');
  };

  // ??敹怎嚗??湔?單?撣嚗?撱箇?敹怎
  const manualSnapshot = async () => {
    await manualRefresh();
    const pLocalNow = JSON.parse(localStorage.getItem('v6_p') || '[]');
    const base = (pLocalNow && pLocalNow.length > 0) ? pLocalNow : portfolios;
    const snap = buildSnapshotFromPortfolios(base);
    const newH = [...history, snap];
    setHistory(newH);
    localStorage.setItem("v6_h", JSON.stringify(newH));
    exportDailySnapshotCSV(snap);
  };

  // Refresh prices for all entries in the selected portfolio
  const manualRefresh = async () => {
    setLoading(true);
    try {
      const pLocal = JSON.parse(localStorage.getItem('v6_p') || '[]');
      const updated = await Promise.all(pLocal.map(async (p) => {
        const newEntries = await Promise.all((p.entries || []).map(async (e) => {
          if (e.type === 'cash') return e;
          const data = await fetchFinanceData(e.symbol, e.type);
          if (!data) return e;
          const rate = e.type === 'US' ? usdtwd : 1;
          const price = (data.price ?? e.currentPrice) || 0;
          return { ...e, currentPrice: price, change: data.change || e.change || 0, valueTWD: Number((Number(e.shares || 0) * price * rate).toFixed(2)) };
        }));
        const total = newEntries.reduce((s, x) => s + (x.valueTWD || 0), 0);
        return { ...p, entries: newEntries, totalTWD: total };
      }));
      setPortfolios(updated);
      localStorage.setItem('v6_p', JSON.stringify(updated));
    } catch (e) {
      console.error('manualRefresh error', e);
    }
    setLoading(false);
  };

  // Start editing an entry
  const startEditEntry = (pId, e) => {
    setEditingEntry({
      pId,
      id: e.id,
      type: e.type || 'TW',
      symbol: e.symbol || '',
      shares: e.shares ?? '',
      targetPct: e.targetPct ?? 0,
    });
  };
  const cancelEditEntry = () => setEditingEntry(null);
  const commitEditEntry = async () => {
    if (!editingEntry) return;
    // ??? shares ????????? >= 0
    const sharesNum = Number(editingEntry.shares);
    if (isNaN(sharesNum) || sharesNum < 0) {
      window.alert('股數必須大於或等於 0。');
      return;
    }
    if (editingEntry.type !== 'cash' && (!editingEntry.symbol || editingEntry.symbol.trim() === '')) {
      window.alert('非現金資產必須填寫代號。');
      return;
    }
    const targetPctNum = Number(editingEntry.targetPct);
    if (isNaN(targetPctNum) || targetPctNum < 0) {
      window.alert('目標配置必須大於或等於 0。');
      return;
    }
    setLoading(true);
    const quoteData =
      editingEntry.type === "cash"
        ? { price: 1, change: 0 }
        : await fetchFinanceData(editingEntry.symbol, editingEntry.type);
    const updated = portfolios.map(p => {
      if (String(p.id) !== String(editingEntry.pId)) return p;
      const entries = (p.entries || []).map(en => {
        if (String(en.id) !== String(editingEntry.id)) return en;
        const newShares = editingEntry.shares;
        const nextType = editingEntry.type || en.type;
        const nextPrice = nextType === "cash" ? 1 : Number(quoteData?.price ?? en.currentPrice ?? 0);
        const nextChange = Number(quoteData?.change ?? en.change ?? 0);
        const rate = nextType === 'US' ? usdtwd : 1;
        let valueTWD = en.valueTWD || 0;
        if (nextType === 'cash') valueTWD = Number(newShares) || 0;
        else valueTWD = Number(newShares || 0) * nextPrice * rate;
        return {
          ...en,
          type: nextType,
          symbol: editingEntry.symbol,
          shares: newShares,
          currentPrice: nextPrice,
          change: nextChange,
          targetPct: targetPctNum,
          valueTWD,
        };
      });
      const total = entries.reduce((s, x) => s + (x.valueTWD || 0), 0);
      return { ...p, entries, totalTWD: total };
    });
    save(updated);
    setLoading(false);
    setEditingEntry(null);
  };

  // 蝯??迂蝺刻摩
  const startEditPortfolio = (p) => setEditingPortfolio({ id: p.id, name: p.name });
  const cancelEditPortfolio = () => setEditingPortfolio(null);
  const commitEditPortfolio = () => {
    if (!editingPortfolio) return;
    if (!editingPortfolio.name || editingPortfolio.name.trim() === '') {
      window.alert('投資組合名稱不可為空。');
      return;
    }
    const updated = portfolios.map(p => p.id === editingPortfolio.id ? { ...p, name: editingPortfolio.name } : p);
    save(updated);
    setEditingPortfolio(null);
  };

  const handleAddEntry = async () => {
    // 撽?頛詨
    if (entry.type !== "cash") {
      if (!entry.symbol || entry.symbol.trim() === '') { window.alert('股票代號不可為空'); return; }
      if (isNaN(Number(entry.shares)) || Number(entry.shares) <= 0) { window.alert('股數必須大於 0。'); return; }
    } else {
      if (isNaN(Number(entry.cash)) || Number(entry.cash) <= 0) { window.alert('現金金額必須大於 0。'); return; }
    }
    setLoading(true);
    const data = await fetchFinanceData(entry.symbol, entry.type);
    const price = data?.price ?? (entry.type === "cash" ? 1 : Number(window.prompt("抓取失敗，請手動輸入價格：")));
    
    if (price) {
      const rate = entry.type === "US" ? usdtwd : 1;
      setTempEntries([...tempEntries, {
        ...entry, id: Date.now(),
        currentPrice: price,
        change: data?.change || 0,
        valueTWD: Number(entry.shares || entry.cash) * price * rate,
        targetPct: Number(entry.targetPct) || 0
      }]);
    }
    setLoading(false);
  };

  return (
    <div style={{...S.app, ...S.appFont}}>
      <header style={S.header}>
        <div style={S.logo}>PORTFOLIO X-STREAM</div>
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <div style={{fontSize:'0.82rem'}}>USD/TWD: <b style={{color:'#38bdf8'}}>{usdtwd.toFixed(2)}</b></div>
            <button style={{...S.btn('primary')}} onClick={async () => { if (!loading) await manualRefresh(); }} disabled={loading}>{loading ? '更新中...' : '更新價格'}</button>
            <button style={{...S.btn()}} onClick={() => exportPortfoliosCSV()}>匯出投資組合 CSV</button>
            <button style={{...S.btn()}} onClick={() => exportHistoryCSV()}>匯出歷史紀錄 CSV</button>
            <input id="importPortfoliosInput" type="file" accept=".csv" style={{display:'none'}} onChange={handleImportPortfoliosFile} />
            <input id="importHistoryInput" type="file" accept=".csv" style={{display:'none'}} onChange={handleImportHistoryFile} />
            <button style={{...S.btn()}} onClick={() => document.getElementById('importPortfoliosInput').click()}>匯入投資組合 CSV</button>
            <button style={{...S.btn()}} onClick={() => document.getElementById('importHistoryInput').click()}>匯入歷史紀錄 CSV</button>
        </div>
      </header>

      <nav style={S.nav}>
        <button style={S.navBtn(tab === "add")} onClick={() => setTab("add")}>{"\u65b0\u589e\u8cc7\u7522"}</button>
        <button style={S.navBtn(tab === "portfolios")} onClick={() => setTab("portfolios")}>{"\u6295\u8cc7\u7d44\u5408"}</button>
        <button style={S.navBtn(tab === "history")} onClick={() => setTab("history")}>{"\u6b77\u53f2\u7d00\u9304"}</button>
        <button style={S.navBtn(tab === "analysis")} onClick={() => setTab("analysis")}>{"\u5206\u6790"}</button>
      </nav>

      <main style={S.content}>
        {tab === "portfolios" && (
          <div style={{display:'flex', flexDirection:'column', gap:'20px', maxHeight:'calc(100vh - 200px)', overflowY:'auto'}}>
            {portfolios.map(p => (
              <div key={p.id} style={{...S.card, width:'100%'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:10, alignItems:'center'}}>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    {editingPortfolio && String(editingPortfolio.id) === String(p.id) ? (
                      <input style={{...S.input, width:220, padding:'6px'}} value={editingPortfolio.name} onChange={e => setEditingPortfolio({...editingPortfolio, name: e.target.value})} />
                    ) : (
                      <span style={{color:'#4a6080', fontWeight:700}}>{p.name}</span>
                    )}
                    {editingPortfolio && String(editingPortfolio.id) === String(p.id) ? (
                      <>
                        <button style={{...S.btn('primary'), padding:'6px 10px'}} onClick={commitEditPortfolio}>{'\u5132\u5b58'}</button>
                        <button style={{...S.btn('danger'), padding:'6px 10px'}} onClick={cancelEditPortfolio}>{'\u53d6\u6d88'}</button>
                      </>
                    ) : (
                      <button style={{...S.btn('primary'), padding:'6px 10px'}} onClick={() => startEditPortfolio(p)}>{'\u7de8\u8f2f\u540d\u7a31'}</button>
                    )}
                  </div>
                  <button style={S.btn('danger')} onClick={() => save(portfolios.filter(x=>x.id!==p.id))}>{'\u522a\u9664'}</button>
                </div>
                <div style={{fontSize:'2rem', fontWeight:900, color:'#38bdf8'}}>NT$ {fmt(p.totalTWD)}</div>
                
                 <button style={{...S.btn('primary'), width:'100%', marginTop:15}} onClick={() => setExpandedAll(!expandedAll)}>
                   {expandedAll ? '\u6536\u5408\u660e\u7d30' : '\u5c55\u958b\u660e\u7d30'}
                 </button>

                 {expandedAll && (
                  <div style={{width: '100%'}}>
                    <table style={{...S.table}}>
                      <thead>
                        <tr>
                          <th style={{...S.th}}>市場</th>
                          <th style={{...S.th}}>代號</th>
                          <th style={{...S.th}}>股數</th>
                          <th style={{...S.th}}>現價</th>
                          <th style={{...S.th}}>漲跌幅 %</th>
                          <th style={{...S.th}}>實際配置 %</th>
                          <th style={{...S.th}}>目標配置 %</th>
                          <th style={{...S.th}}>偏離</th>
                          <th style={{...S.th}}>市值 (TWD)</th>
                          <th style={{...S.th}}>預估損益</th>
                          <th style={{...S.th}}>建議調整</th>
                          <th style={{...S.th}}>操作</th>
                        </tr>
                      </thead>
                    <tbody>
                      {p.entries.map(e => {
                        const actualPct = (e.valueTWD / p.totalTWD) * 100;
                        const gap = actualPct - e.targetPct;
                        const rate = e.type === 'US' ? usdtwd : 1;
                        let suggestedNum = null;
                        let suggestedText = '-';
                        if (e.type !== 'cash' && e.currentPrice) {
                          const desiredValue = p.totalTWD * (Number(e.targetPct) / 100);
                          const desiredShares = desiredValue / (e.currentPrice * rate);
                          const currentShares = Number(e.shares) || 0;
                          const delta = desiredShares - currentShares;
                          suggestedNum = Math.round(delta); // ?撱箄降?⊥
                          suggestedText = (suggestedNum >= 0 ? '+' : '') + suggestedNum;
                        }
                        // 鞈??嚗摯閮?潸???隞亦?亥????閮?嚗?
                        const estChangePct = e.change || 0;
                        const estChangeTWD = e.valueTWD * (estChangePct / 100);
                        const isEditing = editingEntry && String(editingEntry.id) === String(e.id) && String(editingEntry.pId) === String(p.id);
                        return (
                          <tr key={e.id}>
                            <td style={S.td}>{isEditing ? (
                              <select
                                style={{...S.input, padding:'6px'}}
                                value={editingEntry.type || 'TW'}
                                onChange={ev => setEditingEntry({...editingEntry, type: ev.target.value})}
                              >
                                <option value="TW">TW</option>
                                <option value="US">US</option>
                                <option value="cash">{"\u73fe\u91d1"}</option>
                              </select>
                            ) : (<span>{e.type}</span>)}</td>
                            <td style={S.td}>{isEditing ? (
                              <input style={{...S.input, padding:'6px'}} value={editingEntry.symbol || ''} onChange={ev => setEditingEntry({...editingEntry, symbol: ev.target.value})} />
                            ) : (<b>{e.symbol || 'CASH'}</b>)}</td>
                            <td style={S.td}>{isEditing ? (
                              <input style={{...S.input, padding:'6px'}} value={editingEntry.shares || ''} onChange={ev => setEditingEntry({...editingEntry, shares: ev.target.value})} />
                            ) : (e.shares || '-')}</td>
                            <td style={S.td}>{e.currentPrice ? fmt(e.currentPrice,2) : '-'}</td>
                            <td style={S.td}><span style={{color: (e.change||0)>0? '#10b981' : (e.change||0)<0 ? '#ef4444' : '#94a3b8', fontWeight:700}}>{(e.change||0)>=0?'+':''}{Number((e.change||0).toFixed(2))}%</span></td>
                            <td style={S.td}>{actualPct.toFixed(1)}%</td>
                            <td style={S.td}>{isEditing ? (
                              <input
                                style={{...S.input, padding:'6px'}}
                                type="number"
                                min="0"
                                step="0.01"
                                value={editingEntry.targetPct ?? ''}
                                onChange={ev => setEditingEntry({...editingEntry, targetPct: ev.target.value})}
                              />
                            ) : `${e.targetPct}%`}</td>
                            <td style={S.td}><span style={S.gapBadge(gap)}>{gap > 0 ? "+" : ""}{gap.toFixed(1)}%</span></td>
                            <td style={S.td}>{fmt(e.valueTWD)}</td>
                            <td style={S.td}><span style={{color: estChangeTWD>0? '#10b981' : estChangeTWD<0 ? '#ef4444' : '#94a3b8', fontWeight:700}}>{estChangePct>=0?'+':''}{estChangePct.toFixed(2)}% ({fmt(estChangeTWD)})</span></td>
                            <td style={S.td}><span style={{color: suggestedNum>0 ? '#10b981' : suggestedNum<0 ? '#ef4444' : '#94a3b8', fontWeight:700}}>{suggestedText}</span></td>
                            <td style={S.td}>
                              {isEditing ? (
                                <div style={{display:'flex', gap:8}}>
                                  <button style={{...S.btn('primary'), padding:'6px 10px'}} onClick={commitEditEntry}>{'\u5132\u5b58'}</button>
                                  <button style={{...S.btn('danger'), padding:'6px 10px'}} onClick={cancelEditEntry}>{'\u53d6\u6d88'}</button>
                                </div>
                              ) : (
                                <button style={{...S.btn('primary'), padding:'6px 10px'}} onClick={() => startEditEntry(p.id, e)}>{'\u7de8\u8f2f'}</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "add" && (
          <div style={{display:'flex', gap:'24px'}}>
            <div style={{...S.card, flex:1}}>
              <h3>{"1. \u5efa\u7acb\u6295\u8cc7\u7d44\u5408"}</h3>
              <input style={{...S.input, marginBottom:20}} value={pName} onChange={e => setPName(e.target.value)} placeholder="輸入投資組合名稱" />
              
              <div style={{background:'#07111e', padding:20, borderRadius:8}}>
                <h4 style={{marginTop:0}}>{"2. \u65b0\u589e\u8cc7\u7522"}</h4>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                  <div><label style={{fontSize:'0.7rem'}}>{'\u5e02\u5834'}</label>
                    <select style={S.input} value={entry.type} onChange={e => setEntry({...entry, type:e.target.value})}>
                      <option value="TW">TW</option><option value="US">US</option><option value="cash">{"\u73fe\u91d1"}</option>
                    </select>
                  </div>
                  <div><label style={{fontSize:'0.7rem'}}>{'\u4ee3\u865f / \u73fe\u91d1'}</label>
                    <input style={S.input} value={entry.type==='cash'?entry.cash:entry.symbol} onChange={e => entry.type==='cash'?setEntry({...entry, cash:e.target.value}):setEntry({...entry, symbol:e.target.value})} />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10}}>
                  <div><label style={{fontSize:'0.7rem'}}>{'\u80a1\u6578'}</label><input style={S.input} type="number" min="0" step="any" disabled={entry.type==='cash'} value={entry.shares} onChange={e => setEntry({...entry, shares:e.target.value})} /></div>
                  <div><label style={{fontSize:'0.7rem'}}>{'\u76ee\u6a19\u914d\u7f6e (%)'}</label><input style={S.input} type="number" value={entry.targetPct} onChange={e => setEntry({...entry, targetPct:e.target.value})} /></div>
                </div>
                <button style={{...S.btn('primary'), width:'100%', marginTop:20}} onClick={handleAddEntry} disabled={loading}>{loading ? '\u65b0\u589e\u4e2d...' : '\u52a0\u5165\u6295\u8cc7\u7d44\u5408'}</button>
              </div>
            </div>

            <div style={{...S.card, flex:1.5}}>
              <h3>{"\u5f85\u52a0\u5165\u8cc7\u7522"}</h3>
              {tempEntries.map(e => (
                <div key={e.id} style={{display:'flex', justifyContent:'space-between', padding:'12px', borderBottom:'1px solid #1a3050'}}>
                  <div><b>{e.symbol || 'CASH'}</b> - {'\u76ee\u6a19\u914d\u7f6e'} {e.targetPct}%</div>
                  <div style={{display:'flex', gap:15, alignItems:'center'}}>
                    <span>NT$ {fmt(e.valueTWD)}</span>
                    <button style={{...S.btn('danger'), padding:'4px 8px'}} onClick={()=>setTempEntries(tempEntries.filter(x=>x.id!==e.id))}>{'\u522a\u9664'}</button>
                  </div>
                </div>
              ))}
              {tempEntries.length > 0 && <button style={{...S.btn('success'), width:'100%', marginTop:20, padding:15}} onClick={() => {
                const total = tempEntries.reduce((s,x)=>s+x.valueTWD,0);
                save([...portfolios, {id:Date.now(), name:pName, entries:tempEntries, totalTWD:total}]);
                setTempEntries([]); setPName(""); setTab("portfolios");
              }}>{"\u5efa\u7acb\u6295\u8cc7\u7d44\u5408"}</button>}
            </div>
          </div>
        )}

        {tab === "history" && (
          <HistoryPanel
            S={S}
            fmt={fmt}
            history={history}
            setHistory={setHistory}
            expandedHistory={expandedHistory}
            setExpandedHistory={setExpandedHistory}
            manualSnapshot={manualSnapshot}
            createSnapshotForDate={createSnapshotForDate}
            editingSnapshot={editingSnapshot}
            setEditingSnapshot={setEditingSnapshot}
            usdtwd={usdtwd}
            TAIPEI_TZ={TAIPEI_TZ}
          />
        )}

        {tab === "analysis" && (
          <div style={S.card}>
            <h3>{"\u5206\u6790"}</h3>
            <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:12}}>
              <div>
                <label style={{fontSize:'0.8rem', color:'#94a3b8'}}>{'\u7bc4\u570d'}</label>
                <select style={{...S.input, width:160}} defaultValue={'day'} id="analysisGran">
                  <option value="day">{"\u5929"}</option>
                  <option value="week">{"\u9031"}</option>
                  <option value="month">{"\u6708"}</option>
                  <option value="3month">{"3 \u500b\u6708"}</option>
                  <option value="6month">{"6 \u500b\u6708"}</option>
                  <option value="year">{"\u5e74"}</option>
                  <option value="5year">{"5 \u5e74"}</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:'0.8rem', color:'#94a3b8'}}>{'\u76ee\u6a19'}</label>
                <select style={{...S.input, width:220}} defaultValue={'total'} id="analysisTarget">
                  <option value="total">{"\u7e3d\u8cc7\u7522"}</option>
                  {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:'0.8rem', color:'#94a3b8'}}>{'\u958b\u59cb\u65e5\u671f'}</label>
                <input id="analysisStart" type="date" style={{...S.input, width:160}} />
              </div>
              <div>
                <label style={{fontSize:'0.8rem', color:'#94a3b8'}}>{'\u7d50\u675f\u65e5\u671f'}</label>
                <input id="analysisEnd" type="date" style={{...S.input, width:160}} />
              </div>
              <div>
                <button style={{...S.btn('primary')}} onClick={() => {
                  const gran = document.getElementById('analysisGran').value;
                  const target = document.getElementById('analysisTarget').value;
                  const start = document.getElementById('analysisStart').value;
                  const end = document.getElementById('analysisEnd').value;
                  setAnalysisConfig({ gran, target, start, end });
                }}>{"\u5957\u7528"}</button>
              </div>
            </div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:15}}>
              <span style={{fontSize:'0.8rem', color:'#94a3b8', display:'flex', alignItems:'center', marginRight:8}}>{'\u5feb\u901f\u5340\u9593'}</span>
              {[
                {label: '\u0031 \u5929', mode: 'day', amount: 1},
                {label: '\u0031 \u9031', mode: 'day', amount: 7},
                {label: '\u0031 \u500b\u6708', mode: 'month', amount: 1},
                {label: '\u0033 \u500b\u6708', mode: 'month', amount: 3},
                {label: '\u0036 \u500b\u6708', mode: 'month', amount: 6},
                {label: '\u0031 \u5e74', mode: 'year', amount: 1},
                {label: '\u0033 \u5e74', mode: 'year', amount: 3},
                {label: '\u0035 \u5e74', mode: 'year', amount: 5},
              ].map(btn => (
                <button
                  key={btn.label}
                  style={{...S.btn(), padding:'4px 10px', fontSize:'0.8rem', border:'1px solid #1a3050'}}
                  onClick={() => {
                    const end = new Date();
                    const start = new Date(end);
                    if (btn.mode === 'day') start.setDate(start.getDate() - btn.amount);
                    if (btn.mode === 'month') start.setMonth(start.getMonth() - btn.amount);
                    if (btn.mode === 'year') start.setFullYear(start.getFullYear() - btn.amount);
                    
                    const formatYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    const startStr = formatYMD(start);
                    const endStr = formatYMD(end);
                    
                    document.getElementById('analysisStart').value = startStr;
                    document.getElementById('analysisEnd').value = endStr;
                    
                    const gran = document.getElementById('analysisGran').value;
                    const target = document.getElementById('analysisTarget').value;
                    setAnalysisConfig({ gran, target, start: startStr, end: endStr });
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <AnalysisChart history={history} config={analysisConfig} fmt={fmt} COLORS={COLORS} S={S} />
          </div>
        )}
      </main>
    </div>
  );
}

// AnalysisChart moved to src/components/AnalysisChart.jsx



