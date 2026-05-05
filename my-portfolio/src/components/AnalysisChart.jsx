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

const taipeiDateStr = (dateLike) =>
  new Date(dateLike).toLocaleString("sv-SE", { timeZone: TAIPEI_TZ }).split(" ")[0];

export default function AnalysisChart({ history, config, fmt, COLORS, S }) {
  const { gran = "day", target = "total", start, end } = config || {};

  const toKey = (isoTs) => {
    const date = new Date(isoTs);
    if (gran === "day") return taipeiDateStr(date);
    if (gran === "week") {
      const [year, month, day] = taipeiDateStr(date).split("-").map(Number);
      const firstDay = new Date(year, 0, 1);
      const week = Math.ceil((((new Date(year, month - 1, day) - firstDay) / 86400000) + firstDay.getDay() + 1) / 7);
      return `${year}-W${week}`;
    }
    if (gran === "month") {
      const [year, month] = taipeiDateStr(date).split("-");
      return `${year}-${month}`;
    }
    return taipeiDateStr(date).split("-")[0];
  };

  const getSnapTs = (snap) => new Date(snap?.ts || `${snap?.date}T12:00:00+08:00`);

  const getSnapValueForTarget = (snap) => {
    if (!snap) return 0;
    if (target === "total") return snap.value || 0;
    const bucket = (snap.breakdown || []).find((item) => String(item.id) === String(target));
    return (bucket && (bucket.value || 0)) || 0;
  };

  const toNum = (value) => {
    if (value === null || value === undefined) return 0;
    const normalized = String(value).replace(/,/g, "");
    const result = Number(normalized);
    return Number.isNaN(result) ? 0 : result;
  };

  const groupedSnapshots = {};
  (history || []).forEach((snap) => {
    const key = toKey(snap.ts || `${snap.date}T12:00:00+08:00`);
    if (!groupedSnapshots[key]) groupedSnapshots[key] = [];
    groupedSnapshots[key].push(snap);
  });

  const snapshotsByKey = Object.keys(groupedSnapshots)
    .sort()
    .map((key) => {
      const items = groupedSnapshots[key]
        .slice()
        .sort((a, b) => getSnapTs(a).getTime() - getSnapTs(b).getTime());
      return { key, snap: items[items.length - 1] };
    });

  let effectiveSnapshots = snapshotsByKey;
  if (start && end) {
    const startDate = new Date(`${start}T00:00:00+08:00`);
    const endDate = new Date(`${end}T23:59:59.999+08:00`);
    const filtered = snapshotsByKey.filter(({ snap }) => {
      const snapTs = getSnapTs(snap);
      return snapTs >= startDate && snapTs <= endDate;
    });
    if (filtered.length > 0) effectiveSnapshots = filtered;
  }

  const chartData = effectiveSnapshots.map(({ key, snap }) => ({
    time: key,
    value: getSnapValueForTarget(snap),
  }));

  const colorForChange = (value) => (value > 0 ? "#ef4444" : value < 0 ? "#10b981" : "#94a3b8");

  const buildMap = (snap) => {
    const map = {};
    if (!snap) return map;

    const putEntry = (entry) => {
      const original = String(entry.symbol || "CASH").trim();
      const symbol = original.toUpperCase() || "CASH";
      if (!map[symbol]) {
        map[symbol] = {
          symbol,
          display: original || "CASH",
          shares: 0,
          value: 0,
          currentPrice: toNum(entry.currentPrice),
          change: entry.change || 0,
        };
      }
      map[symbol].shares += toNum(entry.shares);
      map[symbol].value += toNum(entry.valueTWD);
      map[symbol].currentPrice = toNum(entry.currentPrice) || map[symbol].currentPrice;
      map[symbol].change = entry.change || map[symbol].change;
    };

    if (target === "total") {
      (snap.breakdown || []).forEach((bucket) => {
        (bucket.entries || []).forEach(putEntry);
      });
    } else {
      const bucket = (snap.breakdown || []).find((item) => String(item.id) === String(target));
      (bucket?.entries || []).forEach(putEntry);
    }

    return map;
  };

  const computeAnnualizedPct = (startValue, endValue, startSnap, endSnap) => {
    try {
      if (!startValue || !endValue || startValue <= 0 || endValue <= 0 || !startSnap || !endSnap) return null;
      const t0 = getSnapTs(startSnap).getTime();
      const t1 = getSnapTs(endSnap).getTime();
      const years = (t1 - t0) / (1000 * 60 * 60 * 24 * 365);
      if (years <= 0) return null;
      return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
    } catch {
      return null;
    }
  };

  let comparisonRows = [];
  let totalSummary = null;

  if (effectiveSnapshots.length >= 1) {
    const latest = effectiveSnapshots[effectiveSnapshots.length - 1].snap;
    let prev = effectiveSnapshots.length >= 2 ? effectiveSnapshots[effectiveSnapshots.length - 2].snap : null;

    if (start && end && effectiveSnapshots.length >= 2) {
      const firstSnap = effectiveSnapshots[0].snap;
      const lastSnap = effectiveSnapshots[effectiveSnapshots.length - 1].snap;
      prev = firstSnap !== lastSnap ? firstSnap : null;
    }

    const latestTotal = getSnapValueForTarget(latest);
    const prevTotal = getSnapValueForTarget(prev);
    const totalDiff = latestTotal - prevTotal;
    const totalPct = prevTotal ? (totalDiff / prevTotal) * 100 : null;
    const totalAnnualizedPct = computeAnnualizedPct(prevTotal, latestTotal, prev, latest);
    totalSummary = { latestTotal, totalDiff, totalPct, totalAnnualizedPct };

    const latestMap = buildMap(latest);
    const prevMap = buildMap(prev);
    const symbols = Array.from(new Set([...Object.keys(latestMap), ...Object.keys(prevMap)])).sort();

    comparisonRows = symbols.map((symbol) => {
      const latestEntry = latestMap[symbol] || {
        symbol,
        display: symbol,
        shares: 0,
        value: 0,
        currentPrice: 0,
        change: 0,
      };
      const prevEntry = prevMap[symbol] || {
        symbol,
        display: symbol,
        shares: 0,
        value: 0,
        currentPrice: 0,
        change: 0,
      };

      const sharesChange = latestEntry.shares - prevEntry.shares;
      const priceChange = latestEntry.currentPrice - prevEntry.currentPrice;
      const priceChangePct = prevEntry.currentPrice ? (priceChange / prevEntry.currentPrice) * 100 : null;
      const valueChange = latestEntry.value - prevEntry.value;
      const pctOfTotal = latestTotal > 0 ? (latestEntry.value / latestTotal) * 100 : null;
      const annualizedPct = computeAnnualizedPct(prevEntry.value, latestEntry.value, prev, latest);

      return {
        symbol,
        display: latestEntry.display || prevEntry.display || symbol,
        latestShares: latestEntry.shares,
        sharesChange,
        priceChange,
        priceChangePct,
        latestValue: latestEntry.value,
        pctOfTotal,
        valueChange,
        annualizedPct,
      };
    });
  }

  return (
    <div>
      {chartData.length === 0 ? (
        <div style={{ color: "#94a3b8" }}>沒有可供分析的資料</div>
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3050" />
              <XAxis dataKey="time" stroke="#4a6080" />
              <YAxis stroke="#4a6080" />
              <Tooltip
                contentStyle={{ background: "#0c1a2e", border: "1px solid #1a3050" }}
                formatter={(value) => [`NT$ ${fmt(value)}`]}
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
            <h4>持股比較分析</h4>
            {comparisonRows.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>目前沒有足夠的快照可以比較</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={S.th}>代號</th>
                    <th style={S.th}>最新持股</th>
                    <th style={S.th}>股數變化</th>
                    <th style={S.th}>價格變化</th>
                    <th style={S.th}>漲跌幅</th>
                    <th style={S.th}>最新價值</th>
                    <th style={S.th}>目前占總資產比重</th>
                    <th style={S.th}>市值變化</th>
                    <th style={S.th}>年化報酬率</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.symbol}>
                      <td style={S.td}>{row.display || row.symbol}</td>
                      <td style={S.td}>{row.latestShares}</td>
                      <td style={{ ...S.td, color: colorForChange(row.sharesChange) }}>
                        {row.sharesChange >= 0 ? "+" : ""}
                        {row.sharesChange}
                      </td>
                      <td style={{ ...S.td, color: colorForChange(row.priceChange || 0) }}>
                        {row.priceChange
                          ? `${row.priceChange >= 0 ? "+" : ""}${fmt(row.priceChange, 2)}`
                          : "-"}
                      </td>
                      <td style={{ ...S.td, color: colorForChange(row.priceChangePct ?? 0) }}>
                        {row.priceChangePct != null
                          ? `${row.priceChangePct >= 0 ? "+" : ""}${row.priceChangePct.toFixed(2)}%`
                          : "-"}
                      </td>
                      <td style={S.td}>NT$ {fmt(row.latestValue)}</td>
                      <td style={S.td}>{row.pctOfTotal != null ? `${row.pctOfTotal.toFixed(2)}%` : "-"}</td>
                      <td style={{ ...S.td, color: colorForChange(row.valueChange) }}>
                        {row.valueChange >= 0 ? "+" : ""}NT$ {fmt(row.valueChange)}
                      </td>
                      <td style={{ ...S.td, color: colorForChange(row.annualizedPct ?? 0) }}>
                        {row.annualizedPct != null
                          ? `${row.annualizedPct >= 0 ? "+" : ""}${row.annualizedPct.toFixed(2)}%`
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
                      <th style={S.th}>年化報酬率</th>
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
                          ? `${totalSummary.totalPct >= 0 ? "+" : ""}${totalSummary.totalPct.toFixed(2)}%`
                          : "-"}
                      </td>
                      <td style={{ ...S.td, color: colorForChange(totalSummary.totalAnnualizedPct ?? 0) }}>
                        {totalSummary.totalAnnualizedPct != null
                          ? `${totalSummary.totalAnnualizedPct >= 0 ? "+" : ""}${totalSummary.totalAnnualizedPct.toFixed(2)}%`
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
