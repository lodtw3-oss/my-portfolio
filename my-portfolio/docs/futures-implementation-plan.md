# Futures Asset Implementation Plan

## Goal

Add futures as a first-class asset type across:

- asset creation and editing
- portfolio valuation
- historical snapshots
- analysis and risk views
- CSV import/export

This plan is based on the current implementation in `src/App.jsx`, `src/components/HistoryPanel.jsx`, `src/components/AnalysisChart.jsx`, and `server/index.js`.

## Backup Baseline

- Local backup archive: `backups/my-portfolio_backup_20260526_075016.zip`
- Backup archive hash: `d8466e1f2a8e2336fe371a7c1134b7daa54f680c`

## Working Assumptions

- Futures should contribute to portfolio net asset value by margin-based account value, not by raw notional.
- Futures exposure should still be tracked separately for risk analysis.
- Existing `TW`, `US`, and `cash` data must remain readable without manual migration work by the user.
- Historical snapshots should preserve enough futures fields to reconstruct exposure and unrealized PnL later.

## Data Model Draft

### Current pain point

The existing `type` field mixes market and asset class:

- `TW`
- `US`
- `cash`

That structure is not sufficient for futures.

### Proposed entry shape

```js
{
  id,
  assetClass: "equity" | "cash" | "futures",
  market: "TW" | "US" | "CME" | "CBOT" | "NYMEX" | "COMEX",
  symbol,
  name,
  quantity,
  targetPct,

  currentPrice,
  change,
  quoteCurrency,
  fxRateToTWD,

  cashAmountTWD,

  side, // "long" | "short"
  entryPrice,
  contractMultiplier,
  initialMargin,
  maintenanceMargin,
  unrealizedPnlTWD,
  notionalValueTWD,
  exposureTWD,
  valueTWD
}
```

### Compatibility draft

- Legacy `TW` or `US` entry maps to:
  - `assetClass = "equity"`
  - `market = legacy type`
  - `quantity = shares`
- Legacy `cash` entry maps to:
  - `assetClass = "cash"`
  - `market = "TWD"`
  - `cashAmountTWD = shares || valueTWD`
- Keep reading `type` and `shares` as fallback during the transition.

## Valuation Draft

### Equity

```js
valueTWD = quantity * currentPrice * fxRateToTWD
```

### Cash

```js
valueTWD = cashAmountTWD
```

### Futures

```js
direction = side === "short" ? -1 : 1
notionalValueTWD = quantity * contractMultiplier * currentPrice * fxRateToTWD
unrealizedPnlTWD = direction * quantity * contractMultiplier * (currentPrice - entryPrice) * fxRateToTWD
exposureTWD = direction * notionalValueTWD
valueTWD = initialMargin + unrealizedPnlTWD
```

### Portfolio-level aggregates to add

```js
{
  totalTWD,
  totalExposureTWD,
  totalMarginTWD,
  totalUnrealizedPnlTWD
}
```

## Task Checklist

### Phase 0: Safety and structure

- [ ] Add a `docs/` planning note for futures changes
- [ ] Add migration-safe normalization helpers for legacy entries
- [ ] Add centralized valuation helpers so future logic is not duplicated

### Phase 1: Shared entry model

- [ ] Add `normalizeEntry(entry)` helper
- [ ] Add `computeEntryMetrics(entry, fxContext)` helper
- [ ] Add `computePortfolioTotals(entries)` helper
- [ ] Update initial localStorage load to normalize all portfolios and snapshots

### Phase 2: Add/Edit asset UI

- [ ] Replace single `type` selector with `assetClass` + `market`
- [ ] Add futures-only fields:
  - `side`
  - `entryPrice`
  - `contractMultiplier`
  - `initialMargin`
  - `maintenanceMargin`
  - `quoteCurrency`
- [ ] Update entry validation rules by asset class
- [ ] Update temp entry preview to show futures-specific metrics
- [ ] Update portfolio entry editing flow for futures fields

### Phase 3: Price refresh and quote pipeline

- [ ] Update frontend quote fetch contract to support futures market values
- [ ] Extend `server/index.js` symbol mapping for futures symbols
- [ ] Support futures quote metadata:
  - `instrumentType`
  - `currency`
  - `asOfDate`
- [ ] Rework `manualRefresh` to compute values by `assetClass`

### Phase 4: Portfolio view

- [ ] Show asset class in tables
- [ ] For futures show:
  - direction
  - quantity
  - multiplier
  - entry price
  - current price
  - unrealized PnL
  - margin
  - notional
  - exposure
- [ ] Split weight concepts into:
  - NAV weight
  - exposure weight
- [ ] Review current rebalance suggestion logic for futures and disable or redesign it where not meaningful

### Phase 5: History and snapshot model

- [ ] Extend snapshot breakdown entries with futures fields
- [ ] Extend snapshot portfolio totals with exposure and margin aggregates
- [ ] Update `buildSnapshotFromPortfolios`
- [ ] Update `createSnapshotForDate`
- [ ] Update manual snapshot flow
- [ ] Update history detail editing rules for futures positions

### Phase 6: Analysis

- [ ] Keep current NAV line chart
- [ ] Add total exposure trend
- [ ] Add futures unrealized PnL trend
- [ ] Add leverage ratio
- [ ] Add margin usage ratio
- [ ] Update comparison table grouping key to avoid merging incompatible futures positions
- [ ] Add total summary metrics for:
  - NAV
  - exposure
  - unrealized PnL
  - annualized return where applicable

### Phase 7: CSV import/export

- [ ] Extend portfolio export columns for futures fields
- [ ] Extend history export breakdown schema
- [ ] Update portfolio CSV import parser
- [ ] Update history CSV import parser
- [ ] Add backward compatibility defaults for old CSVs

### Phase 8: Validation

- [ ] Test legacy equity and cash portfolios still load
- [ ] Test adding a futures contract manually
- [ ] Test refresh recalculates futures PnL correctly
- [ ] Test snapshot creation for same-day and backfilled dates
- [ ] Test CSV export/import round-trip
- [ ] Test analysis page with mixed cash/equity/futures portfolios

## CSV Draft

### Portfolio entry CSV

```csv
portfolioId,portfolioName,id,assetClass,market,symbol,name,quantity,targetPct,currentPrice,change,quoteCurrency,fxRateToTWD,side,entryPrice,contractMultiplier,initialMargin,maintenanceMargin,unrealizedPnlTWD,notionalValueTWD,exposureTWD,valueTWD
```

### Snapshot entry payload fields

Each snapshot entry in `breakdown` should preserve:

- `assetClass`
- `market`
- `symbol`
- `quantity`
- `targetPct`
- `currentPrice`
- `change`
- `quoteCurrency`
- `fxRateToTWD`
- `side`
- `entryPrice`
- `contractMultiplier`
- `initialMargin`
- `maintenanceMargin`
- `unrealizedPnlTWD`
- `notionalValueTWD`
- `exposureTWD`
- `valueTWD`

## Known Risks

- The current UI and logic rely heavily on `type` and `shares`; partial changes will cause inconsistent calculations.
- Existing rebalance suggestions assume spot assets and will be misleading for futures.
- Analysis currently groups by `symbol` only; this can merge different futures positions incorrectly.
- Historical backfill depends on quote availability for the requested date; futures contracts may need explicit symbol conventions.

## Recommended First Implementation Slice

Start with the smallest safe vertical slice:

1. normalize legacy entries
2. add `assetClass` and `market`
3. introduce shared valuation helpers
4. support manual futures entry creation
5. make refresh and portfolio totals futures-aware

This slice gives us working storage and valuation before we touch history and analysis.
