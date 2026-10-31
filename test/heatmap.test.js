import assert from "node:assert/strict";
import test from "node:test";
import { NASDAQ_100_COMPANIES } from "../src/data/nasdaq100.js";
import { DOW_30_COMPANIES } from "../src/data/dow30.js";
import { SP_500_COMPANIES } from "../src/data/sp500.js";
import { DEFAULT_MARKET_ID, MARKET_DEFINITIONS, buildNasdaq100Layout } from "../src/data/markets.js";
import { buildHeatmapSnapshot, buildPlaceholderSnapshot } from "../src/lib/heatmap.js";

test("nasdaq basket contains 101 unique symbols", () => {
  const uniqueSymbols = new Set(NASDAQ_100_COMPANIES.map((company) => company.symbol));

  assert.equal(NASDAQ_100_COMPANIES.length, 101);
  assert.equal(uniqueSymbols.size, 101);
  assert.ok(uniqueSymbols.has("ALNY"));
  assert.ok(uniqueSymbols.has("WDC"));
  assert.ok(uniqueSymbols.has("SNDK"));
  assert.ok(!uniqueSymbols.has("TEAM"));
});

test("nasdaq layout follows roster count with third-row split boxes at 10 and 11", () => {
  assert.equal(DEFAULT_MARKET_ID, "sp500");

  assert.deepEqual(buildNasdaq100Layout(100).rowItemCounts, [20, 20, 20, 20, 20]);
  assert.deepEqual(buildNasdaq100Layout(100).splits, []);

  const oneSplit = buildNasdaq100Layout(101);
  assert.deepEqual(oneSplit.rowItemCounts, [20, 20, 21, 20, 20]);
  assert.deepEqual(oneSplit.splits.map((split) => split.slotIndex), [9]);
  assert.deepEqual(oneSplit.splits.map((split) => split.rowIndex), [2]);

  const twoSplits = buildNasdaq100Layout(102);
  assert.deepEqual(twoSplits.rowItemCounts, [20, 20, 22, 20, 20]);
  assert.deepEqual(twoSplits.splits.map((split) => split.slotIndex), [9, 10]);
  assert.deepEqual(twoSplits.splits.map((split) => split.rowIndex), [2, 2]);
});

test("dow and s&p baskets fit the requested board counts", () => {
  assert.equal(DOW_30_COMPANIES.length, 30);
  assert.equal(SP_500_COMPANIES.length, 500);
  const sp500 = MARKET_DEFINITIONS.find((candidate) => candidate.id === "sp500");
  assert.equal(sp500.layout.rowItemCounts.reduce((total, row) => total + row, 0), 500);
  assert.equal(sp500.layout.columnCount, 25);
});

test("placeholder snapshot starts stale and empty of live data", () => {
  const market = MARKET_DEFINITIONS.find((candidate) => candidate.id === "nasdaq100");
  const snapshot = buildPlaceholderSnapshot(NASDAQ_100_COMPANIES.slice(0, 3), {
    refreshMs: 15_000,
    market
  });

  assert.equal(snapshot.status, "warming");
  assert.equal(snapshot.stale, true);
  assert.equal(snapshot.summary.liveCompanyCount, 0);
  assert.equal(snapshot.sectors.length, 2);
  assert.equal(snapshot.market.id, "nasdaq100");
  assert.equal(snapshot.index.symbol, "NDX");
});

test("heatmap snapshot groups companies and calculates movers", () => {
  const market = MARKET_DEFINITIONS.find((candidate) => candidate.id === "dow30");
  const companies = NASDAQ_100_COMPANIES.filter((company) =>
    ["AAPL", "MSFT", "AMZN"].includes(company.symbol)
  );
  const quotes = [
    {
      symbol: "AAPL",
      currency: "USD",
      marketCap: 3_000,
      regularMarketPrice: 201,
      regularMarketChange: 5,
      regularMarketChangePercent: 2.55,
      regularMarketPreviousClose: 196,
      regularMarketTime: 1_700_000_000,
      marketState: "REGULAR"
    },
    {
      symbol: "MSFT",
      currency: "USD",
      marketCap: 2_900,
      regularMarketPrice: 420,
      regularMarketChange: -4,
      regularMarketChangePercent: -0.94,
      regularMarketPreviousClose: 424,
      regularMarketTime: 1_700_000_100,
      marketState: "REGULAR"
    },
    {
      symbol: "AMZN",
      currency: "USD",
      marketCap: 1_900,
      regularMarketPrice: 180,
      regularMarketChange: 0.02,
      regularMarketChangePercent: 0.01,
      regularMarketPreviousClose: 179.98,
      regularMarketTime: 1_700_000_200,
      marketState: "REGULAR"
    }
  ];

  const snapshot = buildHeatmapSnapshot(companies, quotes, { refreshMs: 15_000, market });

  assert.equal(snapshot.status, "live");
  assert.equal(snapshot.stale, false);
  assert.equal(snapshot.summary.liveCompanyCount, 3);
  assert.equal(snapshot.summary.advancers, 1);
  assert.equal(snapshot.summary.decliners, 1);
  assert.equal(snapshot.summary.unchanged, 1);
  assert.equal(snapshot.summary.biggestMover.symbol, "AAPL");
  assert.equal(snapshot.sectors.length, 2);
  assert.equal(snapshot.marketSession, "Regular session");
  assert.equal(snapshot.market.id, "dow30");
  assert.equal(snapshot.index.symbol, "DJI");
});
