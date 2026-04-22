import React from "react";

export default function HistoryPanel({
  S,
  fmt,
  history,
  setHistory,
  expandedHistory,
  setExpandedHistory,
  manualSnapshot,
  createSnapshotForDate,
  editingSnapshot,
  setEditingSnapshot,
  usdtwd,
  TAIPEI_TZ,
}) {
  const sortedHistory = (history || [])
    .slice()
    .sort((a, b) => {
      const ta = a.ts ? new Date(a.ts).getTime() : new Date(`${a.date || ""}T12:00:00+08:00`).getTime();
      const tb = b.ts ? new Date(b.ts).getTime() : new Date(`${b.date || ""}T12:00:00+08:00`).getTime();
      return tb - ta;
    });

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>每日 14:00 快照</h3>
        <div>
          <button style={{ ...S.btn("primary"), marginRight: 10 }} onClick={manualSnapshot}>
            立即建立快照
          </button>
          <button
            style={{ ...S.btn(), marginRight: 10 }}
            onClick={async () => {
              const date = window.prompt("請輸入要建立快照的日期 (YYYY-MM-DD)：");
              if (!date) return;

              const parsedDate = new Date(`${date}T00:00:00+08:00`);
              if (Number.isNaN(parsedDate.getTime())) {
                window.alert("日期格式不正確");
                return;
              }

              try {
                const snapshot = await createSnapshotForDate(date);
                const newHistory = [...history, snapshot];
                setHistory(newHistory);
                localStorage.setItem("v6_h", JSON.stringify(newHistory));
                window.alert("已建立指定日期快照");
              } catch (error) {
                window.alert(error?.message || "建立指定日期快照失敗");
              }
            }}
          >
            建立指定日期快照
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <h4 style={{ margin: "6px 0" }}>快照歷史</h4>
        <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid #07111e", borderRadius: 8, padding: 6 }}>
          {sortedHistory.map((snapshot) => {
            const key = snapshot.ts || snapshot.date;
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
                    {isOpen ? "收合" : "展開"}
                  </button>
                  <div style={{ color: "#94a3b8" }}>
                    {snapshot.date}{" "}
                    {snapshot.ts ? new Date(snapshot.ts).toLocaleTimeString("zh-TW", { timeZone: TAIPEI_TZ }) : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div>
                    <b>NT$ {fmt(snapshot.value)}</b>
                  </div>
                  <button
                    style={{ ...S.btn("danger"), padding: "4px 8px" }}
                    onClick={() => {
                      const sameDateCount = (history || []).filter((item) => item.date === snapshot.date).length;
                      if (sameDateCount <= 1) {
                        window.alert("該日期至少要保留一筆快照");
                        return;
                      }

                      const newHistory = history.filter(
                        (item) => !(item.date === snapshot.date && (item.ts || "") === (snapshot.ts || ""))
                      );
                      setHistory(newHistory);
                      localStorage.setItem("v6_h", JSON.stringify(newHistory));
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
          const selected = sortedHistory.find((item) => (item.ts || item.date) === expandedHistory);
          if (!selected) return null;

          const fallbackPortfolios = JSON.parse(localStorage.getItem("v6_p") || "[]").map((portfolio) => ({
            id: portfolio.id,
            name: portfolio.name,
            value: portfolio.totalTWD || 0,
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

          const breakdown = selected.breakdown?.length ? selected.breakdown : fallbackPortfolios;
          const note = selected.breakdown?.length ? null : (
            <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginBottom: 8 }}>
              這筆快照沒有保存明細，因此先顯示目前投資組合內容作為參考。
            </div>
          );

          return (
            <div style={{ marginTop: 12, ...S.card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b>快照明細</b> {selected.date}{" "}
                  {selected.ts ? new Date(selected.ts).toLocaleString("zh-TW", { timeZone: TAIPEI_TZ }) : ""}
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
                        <th style={{ ...S.th, padding: "8px" }}>投資組合</th>
                        <th style={{ ...S.th, padding: "8px" }}>代號</th>
                        <th style={{ ...S.th, padding: "8px" }}>股數</th>
                        <th style={{ ...S.th, padding: "8px" }}>價格</th>
                        <th style={{ ...S.th, padding: "8px" }}>漲跌幅 %</th>
                        <th style={{ ...S.th, padding: "8px" }}>市值 (TWD)</th>
                        <th style={{ ...S.th, padding: "8px" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.map((portfolio) => (
                        <React.Fragment key={portfolio.id}>
                          <tr style={{ background: "#07111e" }}>
                            <td style={{ ...S.td, padding: "8px" }} colSpan={7}>
                              <b>{portfolio.name}</b> - NT$ {fmt(portfolio.value)}
                            </td>
                          </tr>

                          {(portfolio.entries || []).map((entryItem) => {
                            const isEditing =
                              editingSnapshot &&
                              editingSnapshot.entryId === entryItem.id &&
                              editingSnapshot.snapshotKey === expandedHistory;

                            return (
                              <tr key={entryItem.id}>
                                <td style={{ ...S.td, padding: "8px" }}></td>
                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing ? (
                                    <input
                                      style={{ ...S.input, width: "80px", padding: "4px" }}
                                      type="text"
                                      value={editingSnapshot.symbol || ""}
                                      onChange={(event) =>
                                        setEditingSnapshot({
                                          ...editingSnapshot,
                                          symbol: event.target.value.toUpperCase(),
                                        })
                                      }
                                    />
                                  ) : (
                                    entryItem.symbol || "CASH"
                                  )}
                                </td>

                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing ? (
                                    <input
                                      style={{ ...S.input, width: "80px", padding: "4px" }}
                                      type="number"
                                      step="any"
                                      value={editingSnapshot.shares || ""}
                                      onChange={(event) =>
                                        setEditingSnapshot({ ...editingSnapshot, shares: event.target.value })
                                      }
                                    />
                                  ) : (
                                    entryItem.shares || "-"
                                  )}
                                </td>

                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing ? (
                                    <input
                                      style={{ ...S.input, width: "80px", padding: "4px" }}
                                      type="number"
                                      step="0.01"
                                      value={editingSnapshot.price || ""}
                                      onChange={(event) =>
                                        setEditingSnapshot({ ...editingSnapshot, price: event.target.value })
                                      }
                                    />
                                  ) : entryItem.currentPrice ? (
                                    fmt(entryItem.currentPrice, 2)
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
                                        onChange={(event) =>
                                          setEditingSnapshot({ ...editingSnapshot, change: event.target.value })
                                        }
                                      />
                                      %
                                    </div>
                                  ) : (
                                    <span
                                      style={{
                                        color:
                                          (entryItem.change || 0) > 0
                                            ? "#10b981"
                                            : (entryItem.change || 0) < 0
                                              ? "#ef4444"
                                              : "#94a3b8",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {(entryItem.change || 0) >= 0 ? "+" : ""}
                                      {Number((entryItem.change || 0).toFixed(2))}%
                                    </span>
                                  )}
                                </td>

                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing
                                    ? fmt(
                                        Number(editingSnapshot.shares || 0) *
                                          Number(editingSnapshot.price || 0) *
                                          (entryItem.type === "US" ? usdtwd : 1)
                                      )
                                    : fmt(entryItem.valueTWD)}
                                </td>

                                <td style={{ ...S.td, padding: "8px" }}>
                                  {isEditing ? (
                                    <div style={{ display: "flex", gap: "4px" }}>
                                      <button
                                        style={{ ...S.btn("primary"), padding: "4px 8px", fontSize: "12px" }}
                                        onClick={() => {
                                          const newPrice = Number(editingSnapshot.price || 0);
                                          const newChange = Number(editingSnapshot.change || 0);

                                          const updatedHistory = history.map((snapshot) => {
                                            if ((snapshot.ts || snapshot.date) !== expandedHistory) return snapshot;

                                            const updatedBreakdown = (snapshot.breakdown || []).map((snapshotPortfolio) => {
                                              if (snapshotPortfolio.id !== portfolio.id) return snapshotPortfolio;

                                              const updatedEntries = (snapshotPortfolio.entries || []).map((snapshotEntry) => {
                                                if (snapshotEntry.id !== entryItem.id) return snapshotEntry;
                                                const rate = snapshotEntry.type === "US" ? usdtwd : 1;
                                                const newValueTWD =
                                                  Number(editingSnapshot.shares || 0) * newPrice * rate;

                                                return {
                                                  ...snapshotEntry,
                                                  symbol: editingSnapshot.symbol,
                                                  shares: editingSnapshot.shares,
                                                  currentPrice: newPrice,
                                                  change: newChange,
                                                  valueTWD: newValueTWD,
                                                };
                                              });

                                              const value = updatedEntries.reduce(
                                                (sum, snapshotEntry) => sum + (snapshotEntry.valueTWD || 0),
                                                0
                                              );
                                              return { ...snapshotPortfolio, entries: updatedEntries, value };
                                            });

                                            const value = updatedBreakdown.reduce(
                                              (sum, snapshotPortfolio) => sum + (snapshotPortfolio.value || 0),
                                              0
                                            );
                                            return { ...snapshot, breakdown: updatedBreakdown, value };
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
                                          entryId: entryItem.id,
                                          symbol: entryItem.symbol || "",
                                          shares: entryItem.shares || "",
                                          price: entryItem.currentPrice || "",
                                          change: entryItem.change || 0,
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
