import React, { useState, useEffect } from "react";
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from "recharts";

// ?????? 1. ??????????????????????? ????????????????????????????????????????????????????????????????????????????????????
const COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fb923c", "#f472b6", "#facc15", "#a78bfa", "#2dd4bf"];
const FINNHUB_KEY = "d6d8s6hr01qgk7ml1bogd6d8s6hr01qgk7ml1bp0"; 

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

// ?????? 2. ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
const fmt = (v, d = 0) => new Intl.NumberFormat("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

async function fetchFinanceData(symbol, market) {
  const clean = symbol.trim().toUpperCase();
  try {
    // Use local proxy to avoid browser CORS and protect API keys.
    const base = (typeof window !== 'undefined' && window && window.location && window.location.hostname === 'localhost') ? 'http://localhost:4000' : '';
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

// ?????? 3. ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
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
  const [analysisConfig, setAnalysisConfig] = useState({ gran: 'month', target: 'total' });
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingPortfolio, setEditingPortfolio] = useState(null);
  const [editingSnapshot, setEditingSnapshot] = useState(null);
  const [lastRetentionDate, setLastRetentionDate] = useState(null);

  // Build a snapshot from current portfolios
  const buildSnapshotFromPortfolios = (pArray) => {
    const date = tsNow.split('T')[0];
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
      // Taipei time = UTC +8
      const taipeiNow = new Date(now + 8 * 3600000);
      const th = taipeiNow.getUTCHours();
      const tm = taipeiNow.getUTCMinutes();

      // Create a daily snapshot at 14:00 Taipei time
      if (th === 14 && tm === 0) {
        const snap = buildSnapshotFromPortfolios(pLocal);
        const hLocal = JSON.parse(localStorage.getItem("v6_h") || "[]");
        const newH = [...hLocal, snap];
        setHistory(newH);
        localStorage.setItem("v6_h", JSON.stringify(newH));
        // ??????????????????????CSV
        exportDailySnapshotCSV(snap);
      }

      // ????????? 00:00 ???????????????????????????????????
      const taipeiDateStr = taipeiNow.toISOString().split('T')[0];
      if (th === 0 && tm === 0 && lastRetentionDate !== taipeiDateStr) {
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
        setLastRetentionDate(taipeiDateStr);
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
      // ??????????????????????????????????????????????????
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
        // ????????????????????????????????
        // alert(`CSV?????????????????????????????????d???: ${filename}`);
      } else {
        console.error('Failed to save CSV to server');
        // fallback: download CSV directly in the browser
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Error saving CSV:', e);
      // fallback: download CSV directly in the browser
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
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

  // ???????????????????CSV
  const exportDailySnapshotCSV = (snap) => {
    if (!snap) return;
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const filename = `daily_snapshot_${snap.date}_${ts}.csv`;
    
    // ???????????????????????
    const rows = [{
      date: snap.date,
      timestamp: snap.ts,
      totalValue: snap.value,
      portfolioCount: (snap.breakdown || []).length
    }];
    
    // ????????????????????????????????
    (snap.breakdown || []).forEach(p => {
      rows.push({
        portfolioId: p.id,
        portfolioName: p.name,
        portfolioValue: p.value,
        entryCount: (p.entries || []).length
      });
      
      // ??????????????????????????
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

  // ?????????????????????????????????????????????????????????????????????????
  const manualSnapshot = () => {
    const snap = buildSnapshotFromPortfolios(portfolios);
    const newH = [...history, snap];
    setHistory(newH);
    localStorage.setItem("v6_h", JSON.stringify(newH));
    // ??????????????????????CSV
    exportDailySnapshotCSV(snap);
  };

  // Refresh prices for all entries in the selected portfolio
  const manualRefresh = async () => {
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
    // ???? shares ??????????????????? >= 0
    const sharesNum = Number(editingEntry.shares);
    if (isNaN(sharesNum) || sharesNum < 0) {
      window.alert('股數必須是大於或等於 0 的數字。');
      return;
    }
    if (editingEntry.type !== 'cash' && (!editingEntry.symbol || editingEntry.symbol.trim() === '')) {
      window.alert('??????????????????????');
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

  // ????????????????????
  const startEditPortfolio = (p) => setEditingPortfolio({ id: p.id, name: p.name });
  const cancelEditPortfolio = () => setEditingPortfolio(null);
  const commitEditPortfolio = () => {
    if (!editingPortfolio) return;
    if (!editingPortfolio.name || editingPortfolio.name.trim() === '') {
      window.alert('????????????????????');
      return;
    }
    const updated = portfolios.map(p => p.id === editingPortfolio.id ? { ...p, name: editingPortfolio.name } : p);
    save(updated);
    setEditingPortfolio(null);
  };

  const handleAddEntry = async () => {
    // ?????????????????????
    if (entry.type !== "cash") {
      if (!entry.symbol || entry.symbol.trim() === '') { window.alert('??????????????????????'); return; }
      if (isNaN(Number(entry.shares)) || Number(entry.shares) <= 0) { window.alert('Shares must be greater than 0.'); return; }
    } else {
      if (isNaN(Number(entry.cash)) || Number(entry.cash) <= 0) { window.alert('Cash amount must be greater than 0.'); return; }
    }
    setLoading(true);
    const data = await fetchFinanceData(entry.symbol, entry.type);
    const price = data?.price ?? (entry.type === "cash" ? 1 : Number(window.prompt("?????????????????????????????????????")));
    
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
                          suggestedNum = Math.round(delta); // ?????????????????????
                          suggestedText = (suggestedNum >= 0 ? '+' : '') + suggestedNum;
                        }
                        // ??????????????????????????????????????(??????????????????????)
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
          <div style={S.card}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>每日 14:00 建立快照</h3>
              <div>
                <button style={{...S.btn('primary'), marginRight:10}} onClick={manualSnapshot}>立即建立快照</button>
                <button style={{...S.btn(), marginRight:10}} onClick={async () => {
                  const date = window.prompt('請輸入快照日期 (YYYY-MM-DD):');
                  if (!date) return;
                  const d = new Date(date + 'T00:00:00');
                  if (isNaN(d.getTime())) { window.alert('無效的日期格式'); return; }
                  const existing = history.find(h => h.date === date);
                  if (existing) { window.alert('該日期已存在快照'); return; }
                  
                  // ????????????????????????????????14:00????????????????????:00 (???????????)
                  const taipeiTime = new Date(d.getTime() + 8 * 3600000); // ???????????
                  const snapshotTime = new Date(taipeiTime);
                  snapshotTime.setHours(14, 0, 0, 0); // ??????????? 14:00
                  
                  const pLocal = JSON.parse(localStorage.getItem('v6_p') || '[]');
                  const snap = buildSnapshotFromPortfolios(pLocal);
                  snap.date = date;
                  snap.ts = snapshotTime.toISOString();
                  
                  const newH = [...history, snap];
                  setHistory(newH);
                  localStorage.setItem('v6_h', JSON.stringify(newH));
                  window.alert('成功建立歷史快照');
                }}>建立指定日期快照</button>
              </div>
            </div>

            <div style={{marginTop:12, marginBottom:12}}>
              <h4 style={{margin:'6px 0'}}>快照詳細資訊</h4>
              <div style={{maxHeight:420, overflow:'auto', border:'1px solid #07111e', borderRadius:8, padding:6}}>
                {history.slice().sort((a, b) => new Date(b.ts || b.date).getTime() - new Date(a.ts || a.date).getTime()).map(h => {
                  const key = (h.ts || h.date);
                  const isOpen = expandedHistory === key;
                  return (
                    <div key={key} style={{borderBottom:'1px solid #07111e', padding:'6px 8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div style={{display:'flex', gap:8, alignItems:'center'}}>
                        <button style={{...S.btn('primary'), padding:'4px 8px'}} onClick={() => setExpandedHistory(isOpen ? null : key)}>{isOpen ? '隱藏' : '顯示'}</button>
                        <div style={{color:'#94a3b8'}}>{h.date} {h.ts ? new Date(h.ts).toLocaleTimeString() : ''}</div>
                      </div>
                      <div style={{display:'flex', gap:8, alignItems:'center'}}>
                        <div><b>NT$ {fmt(h.value)}</b></div>
                        <button style={{...S.btn('danger'), padding:'4px 8px'}} onClick={() => {
                          const sameDateCount = (history || []).filter(x => x.date === h.date).length;
                          if (sameDateCount <= 1) { window.alert('該日期必須至少保留一個快照'); return; }
                          const newH = history.filter(x => !(x.date === h.date && (x.ts || '') === (h.ts || '')));
                          setHistory(newH);
                          localStorage.setItem('v6_h', JSON.stringify(newH));
                          if (expandedHistory === key) setExpandedHistory(null);
                        }}>刪除</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {expandedHistory && (() => {
              const all = history.slice().sort((a, b) => new Date(b.ts || b.date).getTime() - new Date(a.ts || a.date).getTime());
              const sel = all.find(h => (h.ts || h.date) === expandedHistory);
              const h = sel || null;
              if (!h) return null;
              const fallbackP = JSON.parse(localStorage.getItem('v6_p') || '[]').map(p => ({ id: p.id, name: p.name, value: p.totalTWD || 0, entries: (p.entries||[]).map(e=>({ id: e.id, symbol: e.symbol, shares: e.shares, currentPrice: e.currentPrice, change: e.change, valueTWD: e.valueTWD, targetPct: e.targetPct })) }));
              const used = (h.breakdown && h.breakdown.length > 0) ? h.breakdown : fallbackP;
              const note = (h.breakdown && h.breakdown.length > 0) ? null : (<div style={{color:'#94a3b8', fontSize:'0.8rem', marginBottom:8}}>此快照不包含明細，因此顯示目前的投資組合資料作為替代。</div>);
              return (
                <div style={{marginTop:12, ...S.card}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div><b>快照資產</b> {h.date} {h.ts ? new Date(h.ts).toLocaleString() : ''}</div>
                    <div><button style={{...S.btn('danger')}} onClick={() => { setExpandedHistory(null); }}>關閉</button></div>
                  </div>
                  <div style={{marginTop:8}}>
                    {note}
                    <div style={{width: '100%'}}>
                      <table style={{width:'100%', borderCollapse:'collapse'}}>
                        <thead>
                          <tr>
                            <th style={{...S.th, padding:'8px'}}>資產</th>
                            <th style={{...S.th, padding:'8px'}}>代號</th>
                            <th style={{...S.th, padding:'8px'}}>股數</th>
                            <th style={{...S.th, padding:'8px'}}>價格</th>
                            <th style={{...S.th, padding:'8px'}}>報酬率 %</th>
                            <th style={{...S.th, padding:'8px'}}>價值 (TWD)</th>
                            <th style={{...S.th, padding:'8px'}}>操作</th>
                          </tr>
                        </thead>
                      <tbody>
                        {used.map(b => (
                          <React.Fragment key={b.id}>
                            <tr style={{background:'#07111e'}}>
                              <td style={{...S.td, padding:'8px'}} colSpan={7}><b>{b.name}</b> - NT$ {fmt(b.value)}</td>
                            </tr>
                            {(b.entries || []).map(en => {
                              const isEditing = editingSnapshot && editingSnapshot.entryId === en.id && editingSnapshot.snapshotKey === key;
                              return (
                                <tr key={en.id}>
                                  <td style={{...S.td, padding:'8px'}}></td>
                                  <td style={{...S.td, padding:'8px'}}>{en.symbol || 'CASH'}</td>
                                  <td style={{...S.td, padding:'8px'}}>
                                    {isEditing ? (
                                      <input 
                                        style={{...S.input, width:'80px', padding:'4px'}} 
                                        type="number" 
                                        step="any" 
                                        value={editingSnapshot.shares || ''} 
                                        onChange={e => setEditingSnapshot({...editingSnapshot, shares: e.target.value})} 
                                      />
                                    ) : (
                                      en.shares || '-'
                                    )}
                                  </td>
                                  <td style={{...S.td, padding:'8px'}}>
                                    {isEditing ? (
                                      <input 
                                        style={{...S.input, width:'80px', padding:'4px'}} 
                                        type="number" 
                                        step="0.01" 
                                        value={editingSnapshot.price || ''} 
                                        onChange={e => setEditingSnapshot({...editingSnapshot, price: e.target.value})} 
                                      />
                                    ) : (
                                      en.currentPrice ? fmt(en.currentPrice,2) : '-'
                                    )}
                                  </td>
                                  <td style={{...S.td, padding:'8px'}}>
                                    {isEditing ? (
                                      <span style={{color: (editingSnapshot.change||0)>0? '#10b981' : (editingSnapshot.change||0)<0 ? '#ef4444' : '#94a3b8', fontWeight:700}}>
                                        {(editingSnapshot.change||0)>=0?'+':''}{Number((editingSnapshot.change||0).toFixed(2))}%
                                      </span>
                                    ) : (
                                      <span style={{color: (en.change||0)>0? '#10b981' : (en.change||0)<0 ? '#ef4444' : '#94a3b8', fontWeight:700}}>
                                        {(en.change||0)>=0?'+':''}{Number((en.change||0).toFixed(2))}%
                                      </span>
                                    )}
                                  </td>
                                  <td style={{...S.td, padding:'8px'}}>
                                    {isEditing ? (
                                      fmt((Number(editingSnapshot.shares || 0) * Number(editingSnapshot.price || 0) * (en.type === 'US' ? usdtwd : 1)))
                                    ) : (
                                      fmt(en.valueTWD)
                                    )}
                                  </td>
                                  <td style={{...S.td, padding:'8px'}}>
                                    {isEditing ? (
                                      <div style={{display:'flex', gap:'4px'}}>
                                        <button 
                                          style={{...S.btn('primary'), padding:'4px 8px', fontSize:'12px'}} 
                                          onClick={() => {
                                            // Compute price change from the previous price
                                            const prevPrice = en.currentPrice || 0;
                                            const newPrice = Number(editingSnapshot.price || 0);
                                            const change = prevPrice !== 0 ? ((newPrice - prevPrice) / prevPrice) * 100 : 0;
                                            
                                            // ???????????????????
                                            const updatedHistory = history.map(h => {
                                              if ((h.ts || h.date) !== key) return h;
                                              const updatedBreakdown = (h.breakdown || []).map(bd => {
                                                if (bd.id !== b.id) return bd;
                                                const updatedEntries = (bd.entries || []).map(ent => {
                                                  if (ent.id !== en.id) return ent;
                                                  const rate = ent.type === 'US' ? usdtwd : 1;
                                                  const newValueTWD = Number(editingSnapshot.shares || 0) * newPrice * rate;
                                                  return {
                                                    ...ent,
                                                    shares: editingSnapshot.shares,
                                                    currentPrice: newPrice,
                                                    change: change,
                                                    valueTWD: newValueTWD
                                                  };
                                                });
                                                const newTotal = updatedEntries.reduce((sum, ent) => sum + (ent.valueTWD || 0), 0);
                                                return { ...bd, entries: updatedEntries, value: newTotal };
                                              });
                                              const newTotalValue = updatedBreakdown.reduce((sum, bd) => sum + (bd.value || 0), 0);
                                              return { ...h, breakdown: updatedBreakdown, value: newTotalValue };
                                            });
                                            
                                            setHistory(updatedHistory);
                                            localStorage.setItem('v6_h', JSON.stringify(updatedHistory));
                                            setEditingSnapshot(null);
                                          }}
                                        >
                                          儲存
                                        </button>
                                        <button 
                                          style={{...S.btn('danger'), padding:'4px 8px', fontSize:'12px'}} 
                                          onClick={() => setEditingSnapshot(null)}
                                        >
                                          取消
                                        </button>
                                      </div>
                                    ) : (
                                      <button 
                                        style={{...S.btn('primary'), padding:'4px 8px', fontSize:'12px'}} 
                                        onClick={() => setEditingSnapshot({
                                          snapshotKey: key,
                                          entryId: en.id,
                                          shares: en.shares || '',
                                          price: en.currentPrice || '',
                                          change: en.change || 0
                                        })}
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                </div>
              );
            })()}
          </div>
        )}

        {tab === "analysis" && (
          <div style={S.card}>
            <h3>分析</h3>
            <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:12}}>
              <div>
                <label style={{fontSize:'0.8rem', color:'#94a3b8'}}>範圍</label>
                <select style={{...S.input, width:160}} defaultValue={'month'} id="analysisGran">
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
            <AnalysisChart history={history} portfolios={portfolios} config={analysisConfig} fmt={fmt} COLORS={COLORS} />
          </div>
        )}
      </main>
    </div>
  );
}

// ???????????????????????????????????????????????????????????????????????????????????
function AnalysisChart({ history, config, fmt, COLORS }) {
  const { gran = 'month', target = 'total', start, end } = config || {};
  // ????? snapshot -> timeKey
  const toKey = (isoTs) => {
    const d = new Date(isoTs);
    if (gran === 'day') return d.toISOString().split('T')[0];
    if (gran === 'week') {
      const y = d.getFullYear();
      const onejan = new Date(y,0,1);
      const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
      return `${y}-W${week}`;
    }
    if (gran === 'month') return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (gran === '3month') {
      const quarter = Math.floor((d.getMonth() + 3) / 3);
      return `${d.getFullYear()}-Q${quarter}`;
    }
    if (gran === '6month') {
      const half = d.getMonth() < 6 ? 1 : 2;
      return `${d.getFullYear()}-H${half}`;
    }
    if (gran === '5year') {
      const startYear = Math.floor(d.getFullYear() / 5) * 5;
      return `${startYear}-${startYear + 4}`;
    }
    return String(d.getFullYear());
  };

  // Build grouped snapshots (pick last snapshot per time key)
  const groupedSnapshots = {};
  history.forEach(h => {
    const key = toKey(h.ts || (h.date + 'T00:00:00'));
    if (!groupedSnapshots[key]) groupedSnapshots[key] = [];
    groupedSnapshots[key].push(h);
  });

  const keys = Object.keys(groupedSnapshots).sort();
  const snapshotsByKey = keys.map(k => {
    const items = groupedSnapshots[k].slice().sort((a,b) => (a.ts||'') > (b.ts||'') ? 1 : -1);
    return { key: k, snap: items[items.length-1] };
  });

  const data = snapshotsByKey.map(s => ({ time: s.key, value: (target === 'total') ? (s.snap.value || 0) : ((s.snap.breakdown||[]).find(b => String(b.id) === String(target)) || {}).value || 0 }));

  // prepare comparison: latest vs previous
  let comparisonRows = [];
  if (snapshotsByKey.length >= 1) {
    const latest = snapshotsByKey[snapshotsByKey.length-1].snap;
    let prev = snapshotsByKey[snapshotsByKey.length-2] ? snapshotsByKey[snapshotsByKey.length-2].snap : null;

    // if start/end provided, filter snapshotsByKey within inclusive range
    if (start && end) {
      const sDate = new Date(start + 'T00:00:00');
      const eDate = new Date(end + 'T23:59:59');
      const filtered = snapshotsByKey.filter(s => {
        const snapTs = new Date((s.snap.ts || (s.snap.date + 'T00:00:00')));
        return snapTs >= sDate && snapTs <= eDate;
      });
      if (filtered.length > 0) {
        const firstSnap = filtered[0].snap;
        const lastSnap = filtered[filtered.length-1].snap;
        prev = firstSnap !== lastSnap ? firstSnap : null;
        Object.assign(latest, lastSnap);
      }
    }

    const buildMap = (snap) => {
      const map = {};
      if (!snap) return map;
      const norm = (s) => (String(s || '').trim().toUpperCase()) || 'CASH';
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const s = String(v).replace(/,/g, '');
        const n = Number(s);
        return isNaN(n) ? 0 : n;
      };
      if (target === 'total') {
        (snap.breakdown||[]).forEach(b => {
          (b.entries||[]).forEach(en => {
            const orig = String(en.symbol || 'CASH').trim();
            const sym = norm(orig);
            if (!map[sym]) map[sym] = { symbol: sym, display: orig, shares: 0, value: 0, currentPrice: toNum(en.currentPrice) || 0, change: en.change || 0 };
            map[sym].shares = (map[sym].shares || 0) + toNum(en.shares);
            map[sym].value = (map[sym].value || 0) + toNum(en.valueTWD);
            map[sym].currentPrice = toNum(en.currentPrice) || map[sym].currentPrice;
            map[sym].change = en.change || map[sym].change;
          });
        });
      } else {
        const b = (snap.breakdown||[]).find(x => String(x.id) === String(target));
        (b?.entries||[]).forEach(en => {
          const orig = String(en.symbol || 'CASH').trim();
          const sym = norm(orig);
          map[sym] = { symbol: sym, display: orig, shares: toNum(en.shares), value: toNum(en.valueTWD), currentPrice: toNum(en.currentPrice), change: en.change || 0 };
        });
      }
      return map;
    };

    const latestMap = buildMap(latest);
    const prevMap = buildMap(prev);
    const syms = Array.from(new Set([...Object.keys(latestMap), ...Object.keys(prevMap)])).sort();
    comparisonRows = syms.map(sym => {
      const L = latestMap[sym] || { shares:0, value:0, currentPrice:0, change:0, display: sym };
      const P = prevMap[sym] || { shares:0, value:0, currentPrice:0, change:0, display: sym };
      const sharesChange = (L.shares || 0) - (P.shares || 0);
      const priceChange = (L.currentPrice || 0) - (P.currentPrice || 0);
      const priceChangePct = (P.currentPrice && P.currentPrice !== 0) ? ((priceChange / P.currentPrice) * 100) : null;
      const valueChange = (L.value || 0) - (P.value || 0);
      // ????????????????????????prev ??latest ??????????????????> 0
      let annualizedPct = null;
      try {
        if (P.value && P.value !== 0 && L.value && L.value !== 0 && prev && prev.ts && latest && latest.ts) {
          const t0 = new Date(prev.ts).getTime();
          const t1 = new Date(latest.ts).getTime();
          const years = (t1 - t0) / (1000 * 60 * 60 * 24 * 365);
          if (years > 0) {
            annualizedPct = (Math.pow((L.value || 0) / (P.value || 1), 1 / years) - 1) * 100;
          }
        }
      } catch { annualizedPct = null; }
      return {
        symbol: sym,
        display: L.display || P.display || sym,
        latestShares: L.shares || 0,
        sharesChange,
        priceChange,
        priceChangePct,
        latestValue: L.value || 0,
        valueChange,
        annualizedPct
      };
    });
  }

  return (
    <div>
      {data.length === 0 ? <div style={{color:'#94a3b8'}}>沒有可供分析的歷史資料。</div> : (
      <div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3050" />
            <XAxis dataKey="time" stroke="#4a6080" />
            <YAxis stroke="#4a6080" />
            <Tooltip contentStyle={{background:'#0c1a2e', border:'1px solid #1a3050'}} formatter={(v)=>['NT$ '+fmt(v)]} />
            <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={3} dot={{fill:COLORS[0]}} />
          </LineChart>
        </ResponsiveContainer>

        <div style={{marginTop:12}}>
          <h4>資產比較</h4>
          {comparisonRows.length === 0 ? <div style={{color:'#94a3b8'}}>尚無足夠資料來比較變更。</div> : (
            <div style={{width: '100%'}}>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead>
                  <tr>
                    <th style={{...S.th}}>資產</th>
                    <th style={{...S.th}}>最新股數</th>
                    <th style={{...S.th}}>股數變動</th>
                    <th style={{...S.th}}>價格變動</th>
                    <th style={{...S.th}}>價格變動 %</th>
                    <th style={{...S.th}}>最新價值</th>
                    <th style={{...S.th}}>價值變動</th>
                    <th style={{...S.th}}>年化報酬率</th>
                  </tr>
                </thead>
              <tbody>
                {comparisonRows.map(r => (
                  <tr key={r.symbol}>
                    <td style={S.td}>{r.display || r.symbol}</td>
                    <td style={S.td}>{r.latestShares}</td>
                    <td style={S.td}><span style={{color: r.sharesChange > 0 ? '#10b981' : r.sharesChange < 0 ? '#ef4444' : '#94a3b8'}}>{r.sharesChange>=0?'+':''}{r.sharesChange}</span></td>
                    <td style={S.td}><span style={{color: r.priceChange > 0 ? '#10b981' : r.priceChange < 0 ? '#ef4444' : '#94a3b8'}}>{r.priceChange>=0?'+':''}{r.priceChange?fmt(r.priceChange,2):'-'}</span></td>
                    <td style={S.td}><span style={{color: r.priceChangePct != null && r.priceChangePct > 0 ? '#10b981' : r.priceChangePct != null && r.priceChangePct < 0 ? '#ef4444' : '#94a3b8'}}>{r.priceChangePct!=null? (r.priceChangePct>=0?'+':'')+r.priceChangePct.toFixed(2)+'%' : '-'}</span></td>
                    <td style={S.td}>NT$ {fmt(r.latestValue)}</td>
                    <td style={S.td}><span style={{color: r.valueChange > 0 ? '#10b981' : r.valueChange < 0 ? '#ef4444' : '#94a3b8'}}>{r.valueChange>=0?'+':''}NT$ {fmt(r.valueChange)}</span></td>
                    <td style={S.td}><span style={{color: r.annualizedPct != null && r.annualizedPct > 0 ? '#10b981' : r.annualizedPct != null && r.annualizedPct < 0 ? '#ef4444' : '#94a3b8'}}>{r.annualizedPct!=null? (r.annualizedPct>=0?'+':'')+r.annualizedPct.toFixed(2)+'%' : '-'}</span></td>
                  </tr>
                ))}
                {/* ???????????????????? */}
                {comparisonRows.length > 0 && (() => {
                  const totalLatestValue = comparisonRows.reduce((sum, r) => sum + (r.latestValue || 0), 0);
                  const totalValueChange = comparisonRows.reduce((sum, r) => sum + (r.valueChange || 0), 0);
                  const totalPrevValue = totalLatestValue - totalValueChange;
                  const totalChangePct = totalPrevValue !== 0 ? (totalValueChange / totalPrevValue) * 100 : 0;
                  
                  // Calculate weighted annualized return
                  let totalWeightedAnnualized = 0;
                  let totalWeight = 0;
                  comparisonRows.forEach(r => {
                    if (r.annualizedPct != null && r.latestValue > 0) {
                      totalWeightedAnnualized += r.annualizedPct * r.latestValue;
                      totalWeight += r.latestValue;
                    }
                  });
                  const weightedAnnualizedPct = totalWeight > 0 ? totalWeightedAnnualized / totalWeight : null;
                  return (
                    <tr style={{borderTop: '2px solid #1a3050', backgroundColor: '#0c1a2e'}}>
                      <td style={{...S.td, fontWeight: 'bold'}}>總計</td>
                      <td style={S.td}>-</td>
                      <td style={S.td}>-</td>
                      <td style={S.td}>-</td>
                      <td style={S.td}><span style={{color: totalChangePct > 0 ? '#10b981' : totalChangePct < 0 ? '#ef4444' : '#94a3b8', fontWeight: 'bold'}}>{totalChangePct>=0?'+':''}{totalChangePct.toFixed(2)}%</span></td>
                      <td style={S.td}><b>NT$ {fmt(totalLatestValue)}</b></td>
                      <td style={S.td}><span style={{color: totalValueChange > 0 ? '#10b981' : totalValueChange < 0 ? '#ef4444' : '#94a3b8', fontWeight: 'bold'}}>{totalValueChange>=0?'+':''}NT$ {fmt(totalValueChange)}</span></td>
                      <td style={S.td}><span style={{color: weightedAnnualizedPct != null && weightedAnnualizedPct > 0 ? '#10b981' : weightedAnnualizedPct != null && weightedAnnualizedPct < 0 ? '#ef4444' : '#94a3b8', fontWeight: 'bold'}}>{weightedAnnualizedPct!=null? (weightedAnnualizedPct>=0?'+':'')+weightedAnnualizedPct.toFixed(2)+'%' : '-'}</span></td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
