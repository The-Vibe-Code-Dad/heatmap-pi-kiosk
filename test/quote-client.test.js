import assert from "node:assert/strict";
import test from "node:test";
import { SharedQuoteService, fetchSymbolQuote } from "../src/lib/quote-client.js";

function createChartResult(symbol, price = 100) {
  return {
    meta: {
      currency: "USD",
      regularMarketPrice: price,
      chartPreviousClose: price - 1,
      regularMarketTime: 1_700_000_000,
      currentTradingPeriod: {
        regular: {
          start: 1,
          end: 4_000_000_000
        }
      }
    },
    indicators: {
      quote: [
        {
          close: [price]
        }
      ]
    }
  };
}

test("shared quote service warms a limited batch and reuses overlapping cached symbols", async () => {
  const calls = [];
  const service = new SharedQuoteService({
    requestChartImpl: async (symbol) => {
      calls.push(symbol);
      return createChartResult(symbol, 100 + calls.length);
    },
    refreshBatchSize: 2,
    warmupBatchSize: 2,
    maxParallelRequests: 4,
    symbolDelayMs: 0,
    quoteTtlMs: 60_000
  });

  const first = await service.fetchQuotes(["AAPL", "MSFT", "AMZN"], {
    existingQuoteCount: 0
  });

  assert.deepEqual(
    first.map((quote) => quote.symbol),
    ["AAPL", "MSFT"]
  );
  assert.deepEqual(calls, ["AAPL", "MSFT"]);

  const second = await service.fetchQuotes(["AAPL", "MSFT", "NVDA"], {
    existingQuoteCount: 0
  });

  assert.deepEqual(
    second.map((quote) => quote.symbol),
    ["AAPL", "MSFT", "NVDA"]
  );
  assert.deepEqual(calls, ["AAPL", "MSFT", "NVDA"]);
});

test("shared quote service can force refresh for open-bell burst windows", async () => {
  let now = 1_000;
  const calls = [];
  const service = new SharedQuoteService({
    now: () => now,
    requestChartImpl: async (symbol) => {
      calls.push(symbol);
      return createChartResult(symbol, 100 + calls.length);
    },
    refreshBatchSize: 1,
    warmupBatchSize: 1,
    maxParallelRequests: 1,
    symbolDelayMs: 0,
    quoteTtlMs: 60_000
  });

  await service.fetchQuotes(["AAPL"], { existingQuoteCount: 0 });
  now += 500;
  await service.fetchQuotes(["AAPL"], { existingQuoteCount: 1 });
  await service.fetchQuotes(["AAPL"], { existingQuoteCount: 1, maxQuoteAgeMs: 0 });

  assert.deepEqual(calls, ["AAPL", "AAPL"]);
});

test("quote market state uses the quote timestamp when the device clock is stale", async () => {
  const quote = await fetchSymbolQuote("AAPL", {
    requestChartImpl: async () => ({
      meta: {
        currency: "USD",
        regularMarketPrice: 101,
        chartPreviousClose: 100,
        regularMarketTime: 2_500,
        currentTradingPeriod: {
          pre: { start: 500, end: 1_000 },
          regular: { start: 1_000, end: 2_000 },
          post: { start: 2_000, end: 3_000 }
        }
      },
      indicators: {
        quote: [{ close: [101] }]
      }
    })
  });

  assert.equal(quote.marketState, "POST");
  assert.equal(quote.regularMarketTime, 2_500);
});
