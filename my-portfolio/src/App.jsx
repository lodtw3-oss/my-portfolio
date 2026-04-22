import React, { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from "recharts";
import AnalysisChart from "./components/AnalysisChart.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";

// ─── 1. 設定與樣式 ─────────────────────────────────────────────────────
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

// ─── 2. 工具函式 ───────────────────────────────────────────────────────
const fmt = (v, d = 0) => new Intl.NumberFormat("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

const ymdInTaipei = (dateLike) =>
  new Date(dateLike).toLocaleString("sv-SE", { timeZone: TAIPEI_TZ }).split(" ")[0];

const isLocalDevHost = () => {
  if (typeof window === "undefined" || !window?.location?.hostname) return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
};

async function fetchFinanceData(symbol, market) {
  const clean = symbol.trim().toUpperCase();
  try {
    // Use local proxy to avoid browser CORS and protect API keys.
    const base = isLocalDevHost() ? "http://localhost:4000" : "";
    const url = `${base}/api/quote?symbol=${encodeURIComponent(clean)}&market=${encodeURIComponent(market)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data) return null;
    if (data.price !== undefined && data.price !== null) return { price: data.price, change: data.change };
    // fallback if proxy returns raw Yahoo result
    const meta = data.raw?.chart?.result?.[0]?.meta;
    if (meta) return { price: meta.regularMarketPrice, change: ((meta.regularMarketPrice - meta.chartPreviousClose) / (meta.chartPreviousClose || 1)) * 100 };
    return null;
  } catch { return null; }
}

// ─── 3. 主程式 ─────────────────────────────────────────────────────────
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

  // 建立快照（日期以台北時區為準）
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
      // 用 localStorage 記錄，避免重複觸發；並容錯 tm=0~2（避免 setInterval 漂移/背景節流錯過整點）
      if (th === 14 && tm <= 2) {
        const lastAuto = localStorage.getItem('v6_last_auto_snapshot_date') || '';
        if (lastAuto !== taipeiDateStr) {
          localStorage.setItem('v6_last_auto_snapshot_date', taipeiDateStr);
          (async () => {
            try {
              await manualRefresh(); // 先抓最新市價
              const pLocalNow = JSON.parse(localStorage.getItem("v6_p") || "[]");
              const snap = buildSnapshotFromPortfolios(pLocalNow);
              const hLocal = JSON.parse(localStorage.getItem("v6_h") || "[]");
              const newH = [...hLocal, snap];
              setHistory(newH);
              localStorage.setItem("v6_h", JSON.stringify(newH));
              exportDailySnapshotCSV(snap);
            } catch (e) {
              console.error('auto snapshot error', e);
              // 若失敗，讓今天還有機會在下一分鐘重試
              localStorage.removeItem('v6_last_auto_snapshot_date');
            }
          })();
        }
      }

      // 每日台北 00:00 執行保留策略（只執行一次）
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
      // 分析區預設日期：結束日為今日（台北），開始日為結束日前一年內最早有紀錄日
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
        alert(`CSV 成功儲存至伺服器 record 資料夾: ${filename}`);
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
        alert(`無法連線至伺服器，改透過瀏覽器直接下載 CSV: ${filename}`);
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
      alert(`CSV 匯出下載完成: ${filename}`);
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
    const csv = toCSV(rows, ['date','ts','value','breakdown']);
    downloadCSV('snapshots.csv', csv);
  };

  // 匯出每日快照 CSV（下載到本機）
  const exportDailySnapshotCSV = (snap) => {
    if (!snap) return;
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const filename = `daily_snapshot_${snap.date}_${ts}.csv`;
    
    // 第一列：總覽
    const rows = [{
      date: snap.date,
      timestamp: snap.ts,
      totalValue: snap.value,
      portfolioCount: (snap.breakdown || []).length
    }];
    
    // 後續列：組合與明細（依序展開）
    (snap.breakdown || []).forEach(p => {
      rows.push({
        portfolioId: p.id,
        portfolioName: p.name,
        portfolioValue: p.value,
        entryCount: (p.entries || []).length
      });
      
      // 明細列：每個資產
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
        alert('匯入成功！');
      } catch { alert('匯入失敗。請檢查檔案格式後再試一次。'); }
      // reset input
      ev.target.value = '';
    };
    reader.readAsText(f, 'utf-8');
  };

  // 手動快照：先更新即時市價，再建立快照
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
  };
  const cancelEditEntry = () => setEditingEntry(null);
  const commitEditEntry = () => {
    if (!editingEntry) return;
    // 驗證 shares 必須為數字且 >= 0
    const sharesNum = Number(editingEntry.shares);
    if (isNaN(sharesNum) || sharesNum < 0) {
      window.alert('股數必須是大於或等於 0 的數字。');
      return;
    }
    if (editingEntry.type !== 'cash' && (!editingEntry.symbol || editingEntry.symbol.trim() === '')) {
      window.alert('持有股數/金額必須為非負數');
      return;
    }
    const updated = portfolios.map(p => {
      if (String(p.id) !== String(editingEntry.pId)) return p;
      const entries = (p.entries || []).map(en => {
        if (String(en.id) !== String(editingEntry.id)) return en;
        const newShares = editingEntry.shares;
        const rate = en.type === 'US' ? usdtwd : 1;
        let valueTWD = en.valueTWD || 0;
        if (en.type === 'cash') valueTWD = Number(newShares) || 0;
        else valueTWD = Number(newShares || 0) * (en.currentPrice || 0) * rate;
        return { ...en, symbol: editingEntry.symbol, shares: newShares, valueTWD };
      });
      const total = entries.reduce((s, x) => s + (x.valueTWD || 0), 0);
      return { ...p, entries, totalTWD: total };
    });
    save(updated);
    setEditingEntry(null);
  };

  // 組合名稱編輯
  const startEditPortfolio = (p) => setEditingPortfolio({ id: p.id, name: p.name });
  const cancelEditPortfolio = () => setEditingPortfolio(null);
  const commitEditPortfolio = () => {
    if (!editingPortfolio) return;
    if (!editingPortfolio.name || editingPortfolio.name.trim() === '') {
      window.alert('組合名稱不可為空');
      return;
    }
    const updated = portfolios.map(p => p.id === editingPortfolio.id ? { ...p, name: editingPortfolio.name } : p);
    save(updated);
    setEditingPortfolio(null);
  };

  const handleAddEntry = async () => {
    // 驗證輸入
    if (entry.type !== "cash") {
      if (!entry.symbol || entry.symbol.trim() === '') { window.alert('股票代號不可為空'); return; }
      if (isNaN(Number(entry.shares)) || Number(entry.shares) <= 0) { window.alert('Shares must be greater than 0.'); return; }
    } else {
      if (isNaN(Number(entry.cash)) || Number(entry.cash) <= 0) { window.alert('Cash amount must be greater than 0.'); return; }
    }
    setLoading(true);
    const data = await fetchFinanceData(entry.symbol, entry.type);
    const price = data?.price ?? (entry.type === "cash" ? 1 : Number(window.prompt("抓取失敗，請輸入價格:")));
    
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
            <button style={{...S.btn()}} onClick={() => document.getElementById('importPortfoliosInput').click()}>匯入投資組合 CSV</button>
        </div>
      </header>

      <nav style={S.nav}>
        <button style={S.navBtn(tab === "add")} onClick={() => setTab("add")}>新增資產</button>
        <button style={S.navBtn(tab === "portfolios")} onClick={() => setTab("portfolios")}>投資組合</button>
        <button style={S.navBtn(tab === "history")} onClick={() => setTab("history")}>歷史紀錄</button>
        <button style={S.navBtn(tab === "analysis")} onClick={() => setTab("analysis")}>分析</button>
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
                        <button style={{...S.btn('primary'), padding:'6px 10px'}} onClick={commitEditPortfolio}>儲存</button>
                        <button style={{...S.btn('danger'), padding:'6px 10px'}} onClick={cancelEditPortfolio}>取消</button>
                      </>
                    ) : (
                      <button style={{...S.btn('primary'), padding:'6px 10px'}} onClick={() => startEditPortfolio(p)}>編輯名稱</button>
                    )}
                  </div>
                  <button style={S.btn('danger')} onClick={() => save(portfolios.filter(x=>x.id!==p.id))}>刪除</button>
                </div>
                <div style={{fontSize:'2rem', fontWeight:900, color:'#38bdf8'}}>NT$ {fmt(p.totalTWD)}</div>
                
                 <button style={{...S.btn('primary'), width:'100%', marginTop:15}} onClick={() => setExpandedAll(!expandedAll)}>
                   {expandedAll ? "收合" : "展開所有資產"}
                 </button>

                 {expandedAll && (
                  <div style={{width: '100%'}}>
                    <table style={{...S.table}}>
                      <thead>
                        <tr>
                          <th style={{...S.th}}>代號</th>
                          <th style={{...S.th}}>持有數</th>
                          <th style={{...S.th}}>現價</th>
                          <th style={{...S.th}}>報酬率 %</th>
                          <th style={{...S.th}}>目前占比 %</th>
                          <th style={{...S.th}}>目標占比 %</th>
                          <th style={{...S.th}}>差距</th>
                          <th style={{...S.th}}>價值 (TWD)</th>
                          <th style={{...S.th}}>預估變動</th>
                          <th style={{...S.th}}>建議股數</th>
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
                          suggestedNum = Math.round(delta); // 取整建議股數
                          suggestedText = (suggestedNum >= 0 ? '+' : '') + suggestedNum;
                        }
                        // 資產分析：估計價值變動（以當日變動百分比計算）
                        const estChangePct = e.change || 0;
                        const estChangeTWD = e.valueTWD * (estChangePct / 100);
                        const isEditing = editingEntry && String(editingEntry.id) === String(e.id) && String(editingEntry.pId) === String(p.id);
                        return (
                          <tr key={e.id}>
                            <td style={S.td}>{isEditing ? (
                              <input style={{...S.input, padding:'6px'}} value={editingEntry.symbol || ''} onChange={ev => setEditingEntry({...editingEntry, symbol: ev.target.value})} />
                            ) : (<b>{e.symbol || 'CASH'}</b>)}</td>
                            <td style={S.td}>{isEditing ? (
                              <input style={{...S.input, padding:'6px'}} value={editingEntry.shares || ''} onChange={ev => setEditingEntry({...editingEntry, shares: ev.target.value})} />
                            ) : (e.shares || '-')}</td>
                            <td style={S.td}>{e.currentPrice ? fmt(e.currentPrice,2) : '-'}</td>
                            <td style={S.td}><span style={{color: (e.change||0)>0? '#10b981' : (e.change||0)<0 ? '#ef4444' : '#94a3b8', fontWeight:700}}>{(e.change||0)>=0?'+':''}{Number((e.change||0).toFixed(2))}%</span></td>
                            <td style={S.td}>{actualPct.toFixed(1)}%</td>
                            <td style={S.td}>{e.targetPct}%</td>
                            <td style={S.td}><span style={S.gapBadge(gap)}>{gap > 0 ? "+" : ""}{gap.toFixed(1)}%</span></td>
                            <td style={S.td}>{fmt(e.valueTWD)}</td>
                            <td style={S.td}><span style={{color: estChangeTWD>0? '#10b981' : estChangeTWD<0 ? '#ef4444' : '#94a3b8', fontWeight:700}}>{estChangePct>=0?'+':''}{estChangePct.toFixed(2)}% ({fmt(estChangeTWD)})</span></td>
                            <td style={S.td}><span style={{color: suggestedNum>0 ? '#10b981' : suggestedNum<0 ? '#ef4444' : '#94a3b8', fontWeight:700}}>{suggestedText}</span></td>
                            <td style={S.td}>
                              {isEditing ? (
                                <div style={{display:'flex', gap:8}}>
                                  <button style={{...S.btn('primary'), padding:'6px 10px'}} onClick={commitEditEntry}>儲存</button>
                                  <button style={{...S.btn('danger'), padding:'6px 10px'}} onClick={cancelEditEntry}>取消</button>
                                </div>
                              ) : (
                                <button style={{...S.btn('primary'), padding:'6px 10px'}} onClick={() => startEditEntry(p.id, e)}>編輯</button>
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
              <h3>1. 建立投資組合</h3>
              <input style={{...S.input, marginBottom:20}} value={pName} onChange={e => setPName(e.target.value)} placeholder="輸入投資組合名稱" />
              
              <div style={{background:'#07111e', padding:20, borderRadius:8}}>
                <h4 style={{marginTop:0}}>2. 新增資產</h4>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                  <div><label style={{fontSize:'0.7rem'}}>市場</label>
                    <select style={S.input} value={entry.type} onChange={e => setEntry({...entry, type:e.target.value})}>
                      <option value="TW">TW</option><option value="US">US</option><option value="cash">現金</option>
                    </select>
                  </div>
                  <div><label style={{fontSize:'0.7rem'}}>代號 / 現金</label>
                    <input style={S.input} value={entry.type==='cash'?entry.cash:entry.symbol} onChange={e => entry.type==='cash'?setEntry({...entry, cash:e.target.value}):setEntry({...entry, symbol:e.target.value})} />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10}}>
                  <div><label style={{fontSize:'0.7rem'}}>股數</label><input style={S.input} type="number" min="0" step="any" disabled={entry.type==='cash'} value={entry.shares} onChange={e => setEntry({...entry, shares:e.target.value})} /></div>
                  <div><label style={{fontSize:'0.7rem'}}>目標配置 (%)</label><input style={S.input} type="number" value={entry.targetPct} onChange={e => setEntry({...entry, targetPct:e.target.value})} /></div>
                </div>
                <button style={{...S.btn('primary'), width:'100%', marginTop:20}} onClick={handleAddEntry} disabled={loading}>{loading ? '新增中...' : '加入投資組合'}</button>
              </div>
            </div>

            <div style={{...S.card, flex:1.5}}>
              <h3>待加入資產</h3>
              {tempEntries.map(e => (
                <div key={e.id} style={{display:'flex', justifyContent:'space-between', padding:'12px', borderBottom:'1px solid #1a3050'}}>
                  <div><b>{e.symbol || 'CASH'}</b> - 目前占比 {e.targetPct}%</div>
                  <div style={{display:'flex', gap:15, alignItems:'center'}}>
                    <span>NT$ {fmt(e.valueTWD)}</span>
                    <button style={{...S.btn('danger'), padding:'4px 8px'}} onClick={()=>setTempEntries(tempEntries.filter(x=>x.id!==e.id))}>刪除</button>
                  </div>
                </div>
              ))}
              {tempEntries.length > 0 && <button style={{...S.btn('success'), width:'100%', marginTop:20, padding:15}} onClick={() => {
                const total = tempEntries.reduce((s,x)=>s+x.valueTWD,0);
                save([...portfolios, {id:Date.now(), name:pName, entries:tempEntries, totalTWD:total}]);
                setTempEntries([]); setPName(""); setTab("portfolios");
              }}>建立投資組合</button>}
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
            buildSnapshotFromPortfolios={buildSnapshotFromPortfolios}
            editingSnapshot={editingSnapshot}
            setEditingSnapshot={setEditingSnapshot}
            usdtwd={usdtwd}
            TAIPEI_TZ={TAIPEI_TZ}
          />
        )}

        {tab === "analysis" && (
          <div style={S.card}>
            <h3>分析</h3>
            <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:12}}>
              <div>
                <label style={{fontSize:'0.8rem', color:'#94a3b8'}}>範圍</label>
                <select style={{...S.input, width:160}} defaultValue={'day'} id="analysisGran">
                  <option value="day">天</option>
                  <option value="week">週</option>
                  <option value="month">月</option>
                  <option value="3month">3個月</option>
                  <option value="6month">6個月</option>
                  <option value="year">年</option>
                  <option value="5year">5年</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:'0.8rem', color:'#94a3b8'}}>目標</label>
                <select style={{...S.input, width:220}} defaultValue={'total'} id="analysisTarget">
                  <option value="total">所有資產</option>
                  {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:'0.8rem', color:'#94a3b8'}}>開始日期</label>
                <input id="analysisStart" type="date" style={{...S.input, width:160}} />
              </div>
              <div>
                <label style={{fontSize:'0.8rem', color:'#94a3b8'}}>結束日期</label>
                <input id="analysisEnd" type="date" style={{...S.input, width:160}} />
              </div>
              <div>
                <button style={{...S.btn('primary')}} onClick={() => {
                  const gran = document.getElementById('analysisGran').value;
                  const target = document.getElementById('analysisTarget').value;
                  const start = document.getElementById('analysisStart').value;
                  const end = document.getElementById('analysisEnd').value;
                  setAnalysisConfig({ gran, target, start, end });
                }}>套用</button>
              </div>
            </div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:15}}>
              <span style={{fontSize:'0.8rem', color:'#94a3b8', display:'flex', alignItems:'center', marginRight:8}}>快速區間:</span>
              {[
                {label: '1天', mode: 'day', amount: 1},
                {label: '1週', mode: 'day', amount: 7},
                {label: '1個月', mode: 'month', amount: 1},
                {label: '3個月', mode: 'month', amount: 3},
                {label: '6個月', mode: 'month', amount: 6},
                {label: '1年', mode: 'year', amount: 1},
                {label: '3年', mode: 'year', amount: 3},
                {label: '5年', mode: 'year', amount: 5},
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
