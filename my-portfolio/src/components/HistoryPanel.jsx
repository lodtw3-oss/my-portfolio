import React from "react";

export default function HistoryPanel({
  S,
  fmt,
  history,
  setHistory,
  expandedHistory,
  setExpandedHistory,
  manualSnapshot,
  buildSnapshotFromPortfolios,
  editingSnapshot,
  setEditingSnapshot,
  usdtwd,
  TAIPEI_TZ,
}) {
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>每日 14:00 建立快照</h3>
        <div>
          <button style={{ ...S.btn("primary"), marginRight: 10 }} onClick={manualSnapshot}>
            立即建立快照
          </button>
          <button
            style={{ ...S.btn(), marginRight: 10 }}
            onClick={async () => {
              const date = window.prompt("請輸入快照日期 (YYYY-MM-DD):");
              if (!date) return;
              const d = new Date(date + "T00:00:00+08:00");
              if (Number.isNaN(d.getTime())) {
                window.alert("無效的日期格式");
                return;
              }
              const existing = history.find((h) => h.date === date);
              if (existing) {
                window.alert("該日期已存在快照");
                return;
              }

              const snapshotTime = new Date(date + "T14:00:00+08:00");
              const pLocal = JSON.parse(localStorage.getItem("v6_p") || "[]");
              const snap = buildSnapshotFromPortfolios(pLocal);
              snap.date = date;
              snap.ts = snapshotTime.toISOString();

              const newH = [...history, snap];
              setHistory(newH);
              localStorage.setItem("v6_h", JSON.stringify(newH));
              window.alert("成功建立歷史快照");
            }}
          >
            建立指定日期快照
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <h4 style={{ margin: "6px 0" }}>快照詳細資訊</h4>
        <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid #07111e", borderRadius: 8, padding: 6 }}>
          {history
            .slice()
            .sort((a, b) => {
              const ta = a.ts ? new Date(a.ts).getTime() : new Date((a.date || "") + "T12:00:00+08:00").getTime();
              const tb = b.ts ? new Date(b.ts).getTime() : new Date((b.date || "") + "T12:00:00+08:00").getTime();
              return tb - ta;
            })
            .map((h) => {
              const key = h.ts || h.date;
              const isOpen = expandedHistory === key;
              return (
                <div
                  key={key}
                  style={{
                    borderBottom: "1px solid #07111e",
                    padding: "6px 8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      style={{ ...S.btn("primary"), padding: "4px 8px" }}
                      onClick={() => setExpandedHistory(isOpen ? null : key)}
                    >
                      {isOpen ? "隱藏" : "顯示"}
                    </button>
                    <div style={{ color: "#94a3b8" }}>
                      {h.date}{" "}
                      {h.ts ? new Date(h.ts).toLocaleTimeString("zh-TW", { timeZone: TAIPEI_TZ }) : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div>
                      <b>NT$ {fmt(h.value)}</b>
                    </div>
                    <button
                      style={{ ...S.btn("danger"), padding: "4px 8px" }}
                      onClick={() => {
                        const sameDateCount = (history || []).filter((x) => x.date === h.date).length;
                        if (sameDateCount <= 1) {
                          window.alert("該日期必須至少保留一個快照");
                          return;
                        }
                        const newH = history.filter((x) => !(x.date === h.date && (x.ts || "") === (h.ts || "")));
                        setHistory(newH);
                        localStorage.setItem("v6_h", JSON.stringify(newH));
                        if (expandedHistory === key) setExpandedHistory(null);
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {expandedHistory &&
        (() => {
          const all = history
            .slice()
            .sort((a, b) => new Date(b.ts || b.date).getTime() - new Date(a.ts || a.date).getTime());
          const sel = all.find((h) => (h.ts || h.date) === expandedHistory);
          const h = sel || null;
          if (!h) return null;
          const fallbackP = JSON.parse(localStorage.getItem("v6_p") || "[]").map((p) => ({
            id: p.id,
            name: p.name,
            value: p.totalTWD || 0,
            entries: (p.entries || []).map((e) => ({
              id: e.id,
              symbol: e.symbol,
              shares: e.shares,
              currentPrice: e.currentPrice,
              change: e.change,
              valueTWD: e.valueTWD,
              targetPct: e.targetPct,
            })),
          }));
          const used = h.breakdown && h.breakdown.length > 0 ? h.breakdown : fallbackP;
          const note =
            h.breakdown && h.breakdown.length > 0 ? null : (
              <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginBottom: 8 }}>
                此快照不包含明細，因此顯示目前的投資組合資料作為替代。
              </div>
            );
          return (
            <div style={{ marginTop: 12, ...S.card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b>快照資產</b> {h.date}{" "}
                  {h.ts ? new Date(h.ts).toLocaleString("zh-TW", { timeZone: TAIPEI_TZ }) : ""}
                </div>
                <div>
                  <button style={{ ...S.btn("danger") }} onClick={() => setExpandedHistory(null)}>
                    關閉
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {note}
                <div style={{ width: "100%" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...S.th, padding: "8px" }}>資產</th>
                        <th style={{ ...S.th, padding: "8px" }}>代號</th>
                        <th style={{ ...S.th, padding: "8px" }}>股數</th>
                        <th style={{ ...S.th, padding: "8px" }}>價格</th>
                        <th style={{ ...S.th, padding: "8px" }}>漲跌幅 %</th>
                        <th style={{ ...S.th, padding: "8px" }}>價值 (TWD)</th>
                        <th style={{ ...S.th, padding: "8px" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {used.map((b) => (
                        <React.Fragment key={b.id}>
                          <tr style={{ background: "#07111e" }}>
                            <td style={{ ...S.td, padding: "8px" }} colSpan={7}>
                              <b>{b.name}</b> - NT$ {fmt(b.value)}
                            </td>
                          </tr>
                          {(b.entries || []).map((en) => {
                            const isEditing =
                              editingSnapshot &&
                              editingSnapshot.entryId === en.id &&
                              editingSnapshot.snapshotKey === expandedHistory;
                            return (
                              <tr key={en.id}>
                                <td style={{ ...S.td, padding: "8px" }}></td>
                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing ? (
                                    <input
                                      style={{ ...S.input, width: "80px", padding: "4px" }}
                                      type="text"
                                      value={editingSnapshot.symbol || ""}
                                      onChange={(e) =>
                                        setEditingSnapshot({
                                          ...editingSnapshot,
                                          symbol: e.target.value.toUpperCase(),
                                        })
                                      }
                                    />
                                  ) : (
                                    en.symbol || "CASH"
                                  )}
                                </td>
                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing ? (
                                    <input
                                      style={{ ...S.input, width: "80px", padding: "4px" }}
                                      type="number"
                                      step="any"
                                      value={editingSnapshot.shares || ""}
                                      onChange={(e) =>
                                        setEditingSnapshot({ ...editingSnapshot, shares: e.target.value })
                                      }
                                    />
                                  ) : (
                                    en.shares || "-"
                                  )}
                                </td>
                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing ? (
                                    <input
                                      style={{ ...S.input, width: "80px", padding: "4px" }}
                                      type="number"
                                      step="0.01"
                                      value={editingSnapshot.price || ""}
                                      onChange={(e) =>
                                        setEditingSnapshot({ ...editingSnapshot, price: e.target.value })
                                      }
                                    />
                                  ) : en.currentPrice ? (
                                    fmt(en.currentPrice, 2)
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing ? (
                                    <div style={{ display: "flex", alignItems: "center" }}>
                                      <input
                                        style={{ ...S.input, width: "70px", padding: "4px", marginRight: "4px" }}
                                        type="number"
                                        step="0.01"
                                        value={editingSnapshot.change || ""}
                                        onChange={(e) =>
                                          setEditingSnapshot({ ...editingSnapshot, change: e.target.value })
                                        }
                                      />
                                      %
                                    </div>
                                  ) : (
                                    <span
                                      style={{
                                        color:
                                          (en.change || 0) > 0
                                            ? "#10b981"
                                            : (en.change || 0) < 0
                                              ? "#ef4444"
                                              : "#94a3b8",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {(en.change || 0) >= 0 ? "+" : ""}
                                      {Number((en.change || 0).toFixed(2))}%
                                    </span>
                                  )}
                                </td>
                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing
                                    ? fmt(
                                        Number(editingSnapshot.shares || 0) *
                                          Number(editingSnapshot.price || 0) *
                                          (en.type === "US" ? usdtwd : 1)
                                      )
                                    : fmt(en.valueTWD)}
                                </td>
                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing ? (
                                    <div style={{ display: "flex", gap: "4px" }}>
                                      <button
                                        style={{ ...S.btn("primary"), padding: "4px 8px", fontSize: "12px" }}
                                        onClick={() => {
                                          const newPrice = Number(editingSnapshot.price || 0);
                                          const newChange = Number(editingSnapshot.change || 0);

                                          // 更新此快照內的單筆資產資料
                                          const updatedHistory = history.map((hh) => {
                                            if ((hh.ts || hh.date) !== expandedHistory) return hh;
                                            const updatedBreakdown = (hh.breakdown || []).map((bd) => {
                                              if (bd.id !== b.id) return bd;
                                              const updatedEntries = (bd.entries || []).map((ent) => {
                                                if (ent.id !== en.id) return ent;
                                                const rate = ent.type === "US" ? usdtwd : 1;
                                                const newValueTWD = Number(editingSnapshot.shares || 0) * newPrice * rate;
                                                return {
                                                  ...ent,
                                                  symbol: editingSnapshot.symbol,
                                                  shares: editingSnapshot.shares,
                                                  currentPrice: newPrice,
                                                  change: newChange,
                                                  valueTWD: newValueTWD,
                                                };
                                              });
                                              const newTotal = updatedEntries.reduce((sum, ent) => sum + (ent.valueTWD || 0), 0);
                                              return { ...bd, entries: updatedEntries, value: newTotal };
                                            });
                                            const newTotalValue = updatedBreakdown.reduce((sum, bd) => sum + (bd.value || 0), 0);
                                            return { ...hh, breakdown: updatedBreakdown, value: newTotalValue };
                                          });

                                          setHistory(updatedHistory);
                                          localStorage.setItem("v6_h", JSON.stringify(updatedHistory));
                                          setEditingSnapshot(null);
                                        }}
                                      >
                                        儲存
                                      </button>
                                      <button
                                        style={{ ...S.btn("danger"), padding: "4px 8px", fontSize: "12px" }}
                                        onClick={() => setEditingSnapshot(null)}
                                      >
                                        取消
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      style={{ ...S.btn("primary"), padding: "4px 8px", fontSize: "12px" }}
                                      onClick={() =>
                                        setEditingSnapshot({
                                          snapshotKey: expandedHistory,
                                          entryId: en.id,
                                          symbol: en.symbol || "",
                                          shares: en.shares || "",
                                          price: en.currentPrice || "",
                                          change: en.change || 0,
                                        })
                                      }
                                    >
                                      編輯
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
  );
}

