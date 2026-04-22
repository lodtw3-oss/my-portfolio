import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const TAIPEI_TZ = "Asia/Taipei";

const taipeiDateStr = (d) =>
  new Date(d).toLocaleString("sv-SE", { timeZone: TAIPEI_TZ }).split(" ")[0];

export default function AnalysisChart({ history, config, fmt, COLORS, S }) {
  const { gran = "day", target = "total", start, end } = config || {};

  // 轉換 snapshot -> timeKey（以台北時區為準）
  const toKey = (isoTs) => {
    const d = new Date(isoTs);
    if (gran === "day") return taipeiDateStr(d);
    if (gran === "week") {
      const [y, mo, day] = taipeiDateStr(d).split("-").map(Number);
      const onejan = new Date(y, 0, 1);
      const week = Math.ceil(
        (((new Date(y, mo - 1, day) - onejan) / 86400000) + onejan.getDay() + 1) /
          7
      );
      return `${y}-W${week}`;
    }
    if (gran === "month") {
      const [y, mo] = taipeiDateStr(d).split("-");
      return `${y}-${mo}`;
    }
    return taipeiDateStr(d).split("-")[0];
  };

  const getSnapTs = (snap) =>
    new Date(snap.ts || snap.date + "T12:00:00+08:00");

  const getSnapValueForTarget = (snap) => {
    if (!snap) return 0;
    if (target === "total") return snap.value || 0;
    const b = (snap.breakdown || []).find((x) => String(x.id) === String(target));
    return (b && (b.value || 0)) || 0;
  };

  // Build grouped snapshots (pick last snapshot per time key)
  const groupedSnapshots = {};
  (history || []).forEach((h) => {
    const key = toKey(h.ts || h.date + "T12:00:00+08:00");
    if (!groupedSnapshots[key]) groupedSnapshots[key] = [];
    groupedSnapshots[key].push(h);
  });

  const keys = Object.keys(groupedSnapshots).sort();
  const snapshotsByKey = keys.map((k) => {
    const items = groupedSnapshots[k]
      .slice()
      .sort((a, b) => ((a.ts || "") > (b.ts || "") ? 1 : -1));
    return { key: k, snap: items[items.length - 1] };
  });

  // 依比較區間過濾要顯示與比較的快照（若無指定則使用全部）
  let effectiveSnapshots = snapshotsByKey;
  if (start && end) {
    const sDate = new Date(start + "T00:00:00+08:00");
    const eDate = new Date(end + "T23:59:59.999+08:00");
    const filtered = snapshotsByKey.filter((s) => {
      const snapTs = getSnapTs(s.snap);
      return snapTs >= sDate && snapTs <= eDate;
    });
    if (filtered.length > 0) effectiveSnapshots = filtered;
  }

  const data = effectiveSnapshots.map((s) => ({
    time: s.key,
    value: getSnapValueForTarget(s.snap),
  }));

  const colorForChange = (v) =>
    v > 0 ? "#ef4444" : v < 0 ? "#10b981" : "#94a3b8"; // 增加紅、減少綠

  // prepare comparison
  let comparisonRows = [];
  let totalSummary = null;
  if (effectiveSnapshots.length >= 1) {
    const latest = effectiveSnapshots[effectiveSnapshots.length - 1].snap;
    let prev =
      effectiveSnapshots.length >= 2
        ? effectiveSnapshots[effectiveSnapshots.length - 2].snap
        : null;
    if (start && end && effectiveSnapshots.length >= 2) {
      const firstSnap = effectiveSnapshots[0].snap;
      const lastSnap = effectiveSnapshots[effectiveSnapshots.length - 1].snap;
      prev = firstSnap !== lastSnap ? firstSnap : null;
    }

    const latestTotal = getSnapValueForTarget(latest);
    const prevTotal = getSnapValueForTarget(prev);
    const totalDiff = latestTotal - prevTotal;
    const totalPct = prevTotal ? (totalDiff / prevTotal) * 100 : null;
    totalSummary = { latestTotal, totalDiff, totalPct };

    const buildMap = (snap) => {
      const map = {};
      if (!snap) return map;
      const norm = (s) => String(s || "").trim().toUpperCase() || "CASH";
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const s = String(v).replace(/,/g, "");
        const n = Number(s);
        return Number.isNaN(n) ? 0 : n;
      };

      if (target === "total") {
        (snap.breakdown || []).forEach((b) => {
          (b.entries || []).forEach((en) => {
            const orig = String(en.symbol || "CASH").trim();
            const sym = norm(orig);
            if (!map[sym]) {
              map[sym] = {
                symbol: sym,
                display: orig,
                shares: 0,
                value: 0,
                currentPrice: toNum(en.currentPrice) || 0,
                change: en.change || 0,
              };
            }
            map[sym].shares = (map[sym].shares || 0) + toNum(en.shares);
            map[sym].value = (map[sym].value || 0) + toNum(en.valueTWD);
            map[sym].currentPrice = toNum(en.currentPrice) || map[sym].currentPrice;
            map[sym].change = en.change || map[sym].change;
          });
        });
      } else {
        const b = (snap.breakdown || []).find((x) => String(x.id) === String(target));
        (b?.entries || []).forEach((en) => {
          const orig = String(en.symbol || "CASH").trim();
          const sym = norm(orig);
          map[sym] = {
            symbol: sym,
            display: orig,
            shares: toNum(en.shares),
            value: toNum(en.valueTWD),
            currentPrice: toNum(en.currentPrice),
            change: en.change || 0,
          };
        });
      }

      return map;
    };

    const latestMap = buildMap(latest);
    const prevMap = buildMap(prev);
    const syms = Array.from(
      new Set([...Object.keys(latestMap), ...Object.keys(prevMap)])
    ).sort();

    comparisonRows = syms.map((sym) => {
      const L = latestMap[sym] || {
        shares: 0,
        value: 0,
        currentPrice: 0,
        change: 0,
        display: sym,
      };
      const P = prevMap[sym] || {
        shares: 0,
        value: 0,
        currentPrice: 0,
        change: 0,
        display: sym,
      };
      const sharesChange = (L.shares || 0) - (P.shares || 0);
      const priceChange = (L.currentPrice || 0) - (P.currentPrice || 0);
      const priceChangePct =
        P.currentPrice && P.currentPrice !== 0
          ? (priceChange / P.currentPrice) * 100
          : null;
      const valueChange = (L.value || 0) - (P.value || 0);
      const pctOfTotal = latestTotal > 0 ? ((L.value || 0) / latestTotal) * 100 : null;

      let annualizedPct = null;
      try {
        if (
          P.value &&
          P.value !== 0 &&
          L.value &&
          L.value !== 0 &&
          prev &&
          prev.ts &&
          latest &&
          latest.ts
        ) {
          const t0 = new Date(prev.ts).getTime();
          const t1 = new Date(latest.ts).getTime();
          const years = (t1 - t0) / (1000 * 60 * 60 * 24 * 365);
          if (years > 0) {
            annualizedPct = (Math.pow((L.value || 0) / (P.value || 1), 1 / years) - 1) * 100;
          }
        }
      } catch {
        annualizedPct = null;
      }

      return {
        symbol: sym,
        display: L.display || P.display || sym,
        latestShares: L.shares || 0,
        sharesChange,
        priceChange,
        priceChangePct,
        latestValue: L.value || 0,
        pctOfTotal,
        valueChange,
        annualizedPct,
      };
    });
  }

  return (
    <div>
      {data.length === 0 ? (
        <div style={{ color: "#94a3b8" }}>沒有可供分析的歷史資料。</div>
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3050" />
              <XAxis dataKey="time" stroke="#4a6080" />
              <YAxis stroke="#4a6080" />
              <Tooltip
                contentStyle={{ background: "#0c1a2e", border: "1px solid #1a3050" }}
                formatter={(v) => ["NT$ " + fmt(v)]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={COLORS[0]}
                strokeWidth={3}
                dot={{ fill: COLORS[0] }}
              />
            </LineChart>
          </ResponsiveContainer>

          <div style={{ marginTop: 12 }}>
            <h4>比較（最近兩個時段）</h4>
            {comparisonRows.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>尚無足夠資料來比較變更。</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={S.th}>股票</th>
                    <th style={S.th}>最新持股數</th>
                    <th style={S.th}>股數變化</th>
                    <th style={S.th}>市價變化</th>
                    <th style={S.th}>漲跌幅</th>
                    <th style={S.th}>最新價值</th>
                    <th style={S.th}>個股佔總資產比例</th>
                    <th style={S.th}>價值變化</th>
                    <th style={S.th}>年化報酬率</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((r) => (
                    <tr key={r.symbol}>
                      <td style={S.td}>{r.display || r.symbol}</td>
                      <td style={S.td}>{r.latestShares}</td>
                      <td style={{ ...S.td, color: colorForChange(r.sharesChange) }}>
                        {r.sharesChange >= 0 ? "+" : ""}
                        {r.sharesChange}
                      </td>
                      <td style={{ ...S.td, color: colorForChange(r.priceChange || 0) }}>
                        {r.priceChange >= 0 ? "+" : ""}
                        {r.priceChange ? fmt(r.priceChange, 2) : "-"}
                      </td>
                      <td style={{ ...S.td, color: colorForChange(r.priceChangePct ?? 0) }}>
                        {r.priceChangePct != null
                          ? (r.priceChangePct >= 0 ? "+" : "") + r.priceChangePct.toFixed(2) + "%"
                          : "-"}
                      </td>
                      <td style={S.td}>NT$ {fmt(r.latestValue)}</td>
                      <td style={S.td}>
                        {r.pctOfTotal != null ? r.pctOfTotal.toFixed(2) + "%" : "-"}
                      </td>
                      <td style={{ ...S.td, color: colorForChange(r.valueChange) }}>
                        {r.valueChange >= 0 ? "+" : ""}NT$ {fmt(r.valueChange)}
                      </td>
                      <td style={{ ...S.td, color: colorForChange(r.annualizedPct ?? 0) }}>
                        {r.annualizedPct != null
                          ? (r.annualizedPct >= 0 ? "+" : "") + r.annualizedPct.toFixed(2) + "%"
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {totalSummary && (
              <div style={{ marginTop: 12 }}>
                <h4>總價值列表</h4>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={S.th}>最新總價值</th>
                      <th style={S.th}>總價值變化</th>
                      <th style={S.th}>漲跌幅 (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={S.td}>NT$ {fmt(totalSummary.latestTotal)}</td>
                      <td style={{ ...S.td, color: colorForChange(totalSummary.totalDiff) }}>
                        {totalSummary.totalDiff >= 0 ? "+" : ""}NT$ {fmt(totalSummary.totalDiff)}
                      </td>
                      <td style={{ ...S.td, color: colorForChange(totalSummary.totalPct ?? 0) }}>
                        {totalSummary.totalPct != null
                          ? (totalSummary.totalPct >= 0 ? "+" : "") + totalSummary.totalPct.toFixed(2) + "%"
                          : "-"}
                      </td>
                    </tr>
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

