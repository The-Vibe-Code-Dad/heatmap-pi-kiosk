import assert from "node:assert/strict";
import test from "node:test";
import { marketRefreshCadenceMs, nextMarketRefreshDelayMs } from "../src/lib/market-refresh-schedule.js";
import { HeatmapStore } from "../src/lib/store.js";

const MARKET = {
  id: "test",
  title: "TEST HEAT MAP",
  companies: [{ symbol: "AAA", name: "AAA Corp", sector: "Test" }],
  universeEffectiveDate: null,
  universeSourceNote: null,
  index: {
    symbol: "TST",
    quoteSymbol: "^TST",
    name: "Test Index"
  },
  layout: {
    rowItemCounts: [1],
    columnCount: 1,
    split: null
  }
};

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("heatmap store refresh timer idles when no live board is subscribed", async () => {
  let refreshCount = 0;
  const store = new HeatmapStore({
    market: MARKET,
    refreshMs: 10,
    fetcher: async () => {
      refreshCount += 1;
      return [
        {
          symbol: "AAA",
          currency: "USD",
          marketCap: 1,
          regularMarketPrice: 10,
          regularMarketChange: 1,
          regularMarketChangePercent: 1,
          regularMarketPreviousClose: 9,
          regularMarketTime: 1_700_000_000,
          marketState: "REGULAR"
        }
      ];
    },
    indexFetcher: async () => null,
    refreshDelayFor: () => 10,
    logger: {
      error() {},
      warn() {}
    }
  });

  store.start();
  await delay(35);
  assert.equal(refreshCount, 0);

  const unsubscribe = store.subscribe(() => {});
  await delay(35);
  assert.ok(refreshCount > 0);

  unsubscribe();
  store.stop();
});

test("market refresh schedule uses half-hour extended sessions, opening burst, and minute live refreshes", () => {
  const regularRefreshMs = 60_000;

  assert.equal(
    marketRefreshCadenceMs(new Date("2026-04-27T11:45:00.000Z"), regularRefreshMs),
    30 * 60_000
  );
  assert.equal(
    marketRefreshCadenceMs(new Date("2026-04-27T14:00:00.000Z"), regularRefreshMs),
    regularRefreshMs
  );
  assert.equal(
    marketRefreshCadenceMs(new Date("2026-04-27T13:30:00.000Z"), regularRefreshMs),
    1_000
  );
  assert.equal(
    marketRefreshCadenceMs(new Date("2026-04-27T13:30:29.999Z"), regularRefreshMs),
    1_000
  );
  assert.equal(
    marketRefreshCadenceMs(new Date("2026-04-27T13:30:30.000Z"), regularRefreshMs),
    regularRefreshMs
  );
  assert.equal(
    marketRefreshCadenceMs(new Date("2026-04-27T21:15:00.000Z"), regularRefreshMs),
    30 * 60_000
  );
  assert.equal(
    marketRefreshCadenceMs(new Date("2026-04-27T22:01:00.000Z"), regularRefreshMs),
    null
  );
});

test("market refresh schedule aligns extended-session wakes to half-hour marks", () => {
  assert.equal(
    nextMarketRefreshDelayMs(new Date("2026-04-27T20:14:30.000Z"), 60_000),
    15 * 60_000 + 30_000
  );
  assert.equal(nextMarketRefreshDelayMs(new Date("2026-04-27T13:29:59.000Z"), 60_000), 1_000);
  assert.equal(nextMarketRefreshDelayMs(new Date("2026-04-27T13:30:00.000Z"), 60_000), 1_000);
  assert.equal(nextMarketRefreshDelayMs(new Date("2026-04-27T13:30:29.000Z"), 60_000), 1_000);
  assert.equal(nextMarketRefreshDelayMs(new Date("2026-04-27T13:30:30.000Z"), 60_000), 30_000);
  assert.equal(nextMarketRefreshDelayMs(new Date("2026-04-27T14:00:00.000Z"), 60_000), 60_000);
  assert.equal(
    nextMarketRefreshDelayMs(new Date("2026-04-27T22:01:00.000Z"), 60_000),
    13 * 60 * 60_000 + 29 * 60_000
  );
});

test("heatmap store forces quote freshness during the market-open burst", async () => {
  const fetchOptions = [];
  const indexOptions = [];
  const store = new HeatmapStore({
    market: MARKET,
    refreshMs: 60_000,
    fetcher: async (_symbols, options) => {
      fetchOptions.push(options);
      return [
        {
          symbol: "AAA",
          currency: "USD",
          marketCap: 1,
          regularMarketPrice: 10,
          regularMarketChange: 1,
          regularMarketChangePercent: 1,
          regularMarketPreviousClose: 9,
          regularMarketTime: 1_700_000_000,
          marketState: "REGULAR"
        }
      ];
    },
    indexFetcher: async (_symbol, options) => {
      indexOptions.push(options);
      return null;
    },
    refreshCadenceFor: () => 1_000,
    logger: {
      error() {},
      warn() {}
    }
  });

  await store.refresh();

  assert.equal(fetchOptions[0].maxQuoteAgeMs, 0);
  assert.equal(indexOptions[0].maxQuoteAgeMs, 0);
});
