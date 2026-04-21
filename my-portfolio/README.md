# My Portfolio

A portfolio tracking app built with React, Vite, Express, and Recharts.

It supports Taiwan stocks, US stocks, cash assets, daily snapshots, historical analysis, and CSV import/export.

## Features

- Create multiple portfolios
- Add Taiwan stocks, US stocks, and cash assets
- Support cash in `TWD` and `USD`
- Refresh live price and change data
- Save automatic and manual snapshots
- Analyze total assets or a single portfolio over time
- Import and export portfolio data as CSV
- Add new assets directly inside the portfolio detail view

## Stack

- Frontend: React 19, Vite, Recharts
- Backend: Express
- Price source: Yahoo Finance
- Local storage: browser `localStorage`

## Run Locally

Install dependencies:

```bash
npm install
```

Start frontend and local quote proxy together:

```bash
npm start
```

Start frontend only:

```bash
npm run dev
```

Start backend proxy only:

```bash
npm run start:server
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend proxy: `http://localhost:4000`

## Data Storage

The app stores data in browser `localStorage`.

- `v6_p`: portfolio data
- `v6_h`: snapshot history

If browser storage is cleared, all local data is removed.

## Asset Types

### Taiwan Stocks

- `type = TW`
- The app converts the symbol to Yahoo Finance format with `.TW`

### US Stocks

- `type = US`
- Asset value is converted to TWD using the current `USD/TWD` rate

### Cash

- `type = cash`
- Supports `TWD` and `USD`
- `USD CASH` is converted to TWD using the current exchange rate

## Snapshot Rules

- A snapshot is created automatically every day at `14:00` Taipei time
- A manual snapshot can be created in the history page
- The analysis page compares snapshots across a selected time range

## CSV Import and Export

### Export

The app exports two CSV files:

- `portfolios_*.csv`: portfolio summary
- `entries_*.csv`: asset detail rows

### Import

Supported formats:

- Entry-based CSV format
- Older format with an `entries` JSON column

Imported data is normalized automatically, including:

- asset ids
- cash currency
- TWD value conversion
- portfolio total value

## Quote Proxy

Backend endpoint:

```text
GET /api/quote?symbol=XXX&market=TW|US
```

Purpose:

- avoid browser CORS issues
- normalize Taiwan and US stock symbols
- return current price and percent change

## Useful Commands

```bash
npm start
npm run dev
npm run start:server
npm run lint
npm run build
```

## Notes

- Live market data is fetched from Yahoo Finance
- Exchange rate data is fetched from `https://open.er-api.com/v6/latest/USD`
- If displayed values look outdated, click `Refresh Live Data`
- If the UI does not update, reload the page
