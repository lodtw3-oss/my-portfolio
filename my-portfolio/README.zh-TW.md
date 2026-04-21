# My Portfolio 說明文件

這是一個用 React、Vite、Express 與 Recharts 製作的投資組合管理工具。

目前支援：

- 台股
- 美股
- 現金資產
- 每日快照
- 歷史分析
- CSV 匯入與匯出

## 主要功能

- 建立多個投資組合
- 新增台股、美股與現金資產
- 現金可選擇 `TWD` 或 `USD`
- 更新即時價格與漲跌幅
- 自動建立每日快照
- 手動建立快照
- 分析總資產或單一組合的區間變化
- 直接在資產庫詳細區新增資產

## 技術架構

- 前端：React 19、Vite、Recharts
- 後端：Express
- 報價來源：Yahoo Finance
- 本機資料儲存：瀏覽器 `localStorage`

## 啟動方式

先安裝套件：

```bash
npm install
```

同時啟動前端與本機報價 proxy：

```bash
npm start
```

只啟動前端：

```bash
npm run dev
```

只啟動後端 proxy：

```bash
npm run start:server
```

預設網址：

- 前端：`http://localhost:5173`
- 後端：`http://localhost:4000`

## 資料儲存

資料會存放在瀏覽器 `localStorage`：

- `v6_p`：投資組合資料
- `v6_h`：快照歷史

如果清除瀏覽器儲存資料，組合與快照也會一起被刪除。

## 資產類型

### 台股

- `type = TW`
- 送到 Yahoo Finance 前會自動補上 `.TW`

### 美股

- `type = US`
- 市值會依照目前 `USD/TWD` 匯率換算成台幣

### 現金

- `type = cash`
- 支援 `TWD` 與 `USD`
- `USD CASH` 會依照目前匯率換算成台幣市值

## 快照規則

- 每天台北時間 `14:00` 自動建立一筆快照
- 可以在快照歷史頁手動建立快照
- 資產分析頁會依照指定時間區間比較快照

## CSV 匯入與匯出

### 匯出

會輸出兩種 CSV：

- `portfolios_*.csv`：組合摘要
- `entries_*.csv`：資產明細

### 匯入

支援以下格式：

- 明細列格式 CSV
- 舊版 `entries` JSON 欄位格式

匯入時會自動整理資料，包含：

- 補齊資產 `id`
- 修正現金幣別欄位
- 計算台幣市值
- 重算組合總資產

## 報價 Proxy

後端提供：

```text
GET /api/quote?symbol=XXX&market=TW|US
```

用途：

- 避免瀏覽器直接呼叫第三方報價服務的 CORS 問題
- 統一台股 / 美股代號格式
- 回傳目前價格與漲跌幅

## 常用指令

```bash
npm start
npm run dev
npm run start:server
npm run lint
npm run build
```

## 注意事項

- 即時價格主要來自 Yahoo Finance
- 匯率資料來自 `https://open.er-api.com/v6/latest/USD`
- 如果數值看起來不是最新，先按一次 `更新即時數據`
- 如果畫面沒有更新，請重新整理頁面
