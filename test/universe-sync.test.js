import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createMarketDefinitions } from "../src/data/markets.js";
import {
  UniverseSyncService,
  getNextUniverseSyncTime,
  loadUniverseCache,
  shouldRunUniverseSyncNow
} from "../src/lib/universe-sync.js";

test("universe sync waits until 9:00 AM Eastern on weekdays", () => {
  assert.equal(shouldRunUniverseSyncNow(null, new Date("2026-04-21T12:59:00.000Z")), false);
  assert.equal(shouldRunUniverseSyncNow(null, new Date("2026-04-21T13:01:00.000Z")), true);
  assert.equal(
    shouldRunUniverseSyncNow("2026-04-21T13:05:00.000Z", new Date("2026-04-21T15:00:00.000Z")),
    false
  );
});

test("next universe sync skips to the next market day", () => {
  const nextSync = getNextUniverseSyncTime(new Date("2026-04-24T14:00:00.000Z"));

  assert.equal(nextSync.toISOString(), "2026-04-27T13:00:00.000Z");
});

test("sp500 universe sync uses a non-pre-encoded wikipedia page title", () => {
  const sp500 = createMarketDefinitions().find((market) => market.id === "sp500");

  assert.equal(sp500?.source?.pageTitle, "List_of_S&P_500_companies");
});

test("universe prime does not overwrite a newer manual sync timestamp", async () => {
  const service = new UniverseSyncService({
    markets: [],
    stores: new Map(),
    cacheFile: path.join(os.tmpdir(), "unused-market-universe-cache.json"),
    logger: {
      error() {},
      warn() {},
      info() {}
    }
  });

  service.lastSyncedAt = "2099-01-01T00:00:00.000Z";

  await service.prime({ lastSyncedAt: "2026-04-26T12:00:00.000Z" });
  service.stop();

  assert.equal(service.lastSyncedAt, "2099-01-01T00:00:00.000Z");
});

test("universe cache load falls back when a power cut leaves corrupt cache json", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-universe-corrupt-"));
  const cacheFile = path.join(tempDir, "market-universe-cache.json");
  const markets = createMarketDefinitions();
  const warnings = [];

  await writeFile(cacheFile, "{\"version\":1,\"markets\":", "utf8");

  const result = await loadUniverseCache({
    markets,
    cacheFile,
    logger: {
      warn: (...args) => warnings.push(args)
    }
  });

  assert.deepEqual(result, { lastSyncedAt: null });
  assert.equal(warnings.length, 1);
  assert.ok(markets.find((market) => market.id === "nasdaq100")?.companies.length > 0);
});

test("universe cache rejects parseable company rows that would break heatmap sectors", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-universe-invalid-"));
  const cacheFile = path.join(tempDir, "market-universe-cache.json");
  const markets = createMarketDefinitions();
  const nasdaq100 = markets.find((market) => market.id === "nasdaq100");
  const bundledFirstSymbol = nasdaq100.companies[0].symbol;

  await writeFile(
    cacheFile,
    JSON.stringify({
      version: 1,
      syncedAt: "2026-04-26T12:00:00.000Z",
      markets: {
        nasdaq100: {
          companies: Array.from({ length: 101 }, () => ({ symbol: "BAD", name: "Bad Cache" })),
          universeEffectiveDate: "2026-04-26",
          universeSourceNote: "malformed cache"
        }
      }
    }),
    "utf8"
  );

  const result = await loadUniverseCache({
    markets,
    cacheFile,
    logger: {
      warn: () => {}
    }
  });

  assert.equal(result.lastSyncedAt, "2026-04-26T12:00:00.000Z");
  assert.equal(nasdaq100.companies[0].symbol, bundledFirstSymbol);
});

test("universe cache accepts Nasdaq rosters that gain or lose the split tile", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-universe-nasdaq-count-"));
  const cacheFile = path.join(tempDir, "market-universe-cache.json");
  const markets = createMarketDefinitions();
  const nasdaq100 = markets.find((market) => market.id === "nasdaq100");
  const cachedCompanies = nasdaq100.companies.slice(0, 100);

  await writeFile(
    cacheFile,
    JSON.stringify({
      version: 1,
      syncedAt: "2026-04-26T12:00:00.000Z",
      markets: {
        nasdaq100: {
          companies: cachedCompanies,
          universeEffectiveDate: "2026-04-26",
          universeSourceNote: "100-name roster"
        }
      }
    }),
    "utf8"
  );

  await loadUniverseCache({
    markets,
    cacheFile,
    logger: {
      warn: () => {}
    }
  });

  assert.equal(nasdaq100.companies.length, 100);
});
