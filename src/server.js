import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { DEFAULT_MARKET_ID, createMarketDefinitions } from "./data/markets.js";
import { DeviceService } from "./lib/device-service.js";
import { DeviceSettingsStore } from "./lib/device-settings.js";
import { marketRefreshCadenceMs, nextMarketRefreshDelayMs } from "./lib/market-refresh-schedule.js";
import { fetchQuotes } from "./lib/quote-client.js";
import { isLoopbackAddress, originMatchesLoopback } from "./lib/request-guards.js";
import { HeatmapStore } from "./lib/store.js";
import { UniverseSyncService, loadUniverseCache } from "./lib/universe-sync.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const refreshMs = Number.parseInt(process.env.REFRESH_MS ?? "60000", 10);
const startupRefreshDelayMs = Number.parseInt(process.env.STARTUP_REFRESH_DELAY_MS ?? "8000", 10);
const universeStartupDelayMs = Number.parseInt(process.env.UNIVERSE_STARTUP_DELAY_MS ?? "30000", 10);
const universeCacheFile = path.join(rootDir, "data-cache", "market-universes.json");
const deviceSettingsFile = path.join(rootDir, "data-cache", "device-settings.json");
const markets = createMarketDefinitions();
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");
const permissionsPolicy = [
  "accelerometer=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "microphone=()",
  "payment=()",
  "usb=()"
].join(", ");
const { lastSyncedAt } = await loadUniverseCache({
  markets,
  cacheFile: universeCacheFile,
  logger: console
});

const app = express();
const stores = new Map(
  markets.map((market) => [
    market.id,
    new HeatmapStore({
      market,
      refreshMs
    })
  ])
);
const marketsById = new Map(markets.map((market) => [market.id, market]));
const deviceSettingsStore = new DeviceSettingsStore({
  file: deviceSettingsFile,
  allowedMarketIds: markets.map((market) => market.id),
  logger: console
});
const deviceService = new DeviceService({
  settingsStore: deviceSettingsStore,
  logger: console
});
const universeSyncService = new UniverseSyncService({
  markets,
  stores,
  cacheFile: universeCacheFile,
  logger: console
});
let immediateSyncPromise = null;

function resolveStore(marketId) {
  const resolvedMarket = marketsById.get(`${marketId ?? ""}`) ?? marketsById.get(DEFAULT_MARKET_ID);
  return stores.get(resolvedMarket.id);
}

function respondWithError(response, error) {
  response.status(500).json({
    ok: false,
    error: error instanceof Error ? error.message : "Unexpected error."
  });
}

function requestPort(request) {
  const hostHeader = `${request.get("host") ?? ""}`.trim();

  try {
    const parsed = new URL(`http://${hostHeader}`);
    return parsed.port || `${port}`;
  } catch {
    return `${port}`;
  }
}

function rejectForbidden(response, message) {
  response.status(403).json({
    ok: false,
    error: message
  });
}

function startupQuoteRefreshDelayMs(date = new Date()) {
  if (marketRefreshCadenceMs(date, refreshMs) === null) {
    return nextMarketRefreshDelayMs(date, refreshMs);
  }

  return Math.max(0, startupRefreshDelayMs);
}

async function syncMarketDataNow(reason = "manual") {
  if (immediateSyncPromise !== null) {
    return immediateSyncPromise;
  }

  immediateSyncPromise = (async () => {
    const errors = [];

    try {
      await universeSyncService.syncNow(reason);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Universe sync failed.");
      console.error("Universe sync-now failed.", error);
    }

    const marketResults = await Promise.allSettled(
      markets.map(async (market) => {
        const store = stores.get(market.id);

        try {
          await store.prime();
          return market.id;
        } catch (error) {
          errors.push(
            error instanceof Error
              ? `${market.id}: ${error.message}`
              : `${market.id}: quote refresh failed.`
          );
          console.error(`Sync-now quote refresh failed for ${market.id}.`, error);
          return null;
        }
      })
    );

    return {
      refreshedMarkets: marketResults
        .filter((result) => result.status === "fulfilled" && result.value !== null)
        .map((result) => result.value),
      errors
    };
  })().finally(() => {
    immediateSyncPromise = null;
  });

  return immediateSyncPromise;
}

async function syncAtStartupIfWifiConnected() {
  const status = await deviceService.getStatus();

  if (!status.wifi?.connection) {
    return;
  }

  await syncMarketDataNow("startup Wi-Fi connected");
}

function requireLoopbackDeviceAccess(request, response, next) {
  if (!isLoopbackAddress(request.socket.remoteAddress)) {
    rejectForbidden(response, "Device control is only available from the local kiosk.");
    return;
  }

  next();
}

function requireTrustedDeviceOrigin(request, response, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    next();
    return;
  }

  if (!originMatchesLoopback(request.get("origin"), requestPort(request), request.protocol)) {
    rejectForbidden(response, "Cross-site device control requests are blocked.");
    return;
  }

  next();
}

app.disable("x-powered-by");
app.use((_request, response, next) => {
  response.setHeader("Content-Security-Policy", contentSecurityPolicy);
  response.setHeader("Permissions-Policy", permissionsPolicy);
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  next();
});
app.use(express.json());
app.use("/vendor/d3", express.static(path.join(rootDir, "node_modules", "d3", "dist")));
app.use(express.static(path.join(rootDir, "public")));
app.use("/api/device", requireLoopbackDeviceAccess, requireTrustedDeviceOrigin);

function buildTickerTapeItem(symbol, quote) {
  if (!quote) {
    return {
      symbol,
      price: null,
      change: 0,
      changePercent: 0,
      available: false
    };
  }

  return {
    symbol,
    price: quote.regularMarketPrice ?? null,
    change: quote.regularMarketChange ?? 0,
    changePercent: quote.regularMarketChangePercent ?? 0,
    available: quote.regularMarketPrice !== null
  };
}

app.get("/api/health", (request, response) => {
  const store = resolveStore(request.query.market);
  const snapshot = store.getSnapshot();

  response.json({
    ok: true,
    market: snapshot.market.id,
    status: snapshot.status,
    stale: snapshot.stale,
    liveCompanyCount: snapshot.summary.liveCompanyCount,
    fetchedAt: snapshot.fetchedAt
  });
});

app.get("/api/heatmap", (request, response) => {
  const store = resolveStore(request.query.market);
  response.json(store.getSnapshot());
});

app.get("/api/stream", (request, response) => {
  const store = resolveStore(request.query.market);
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders?.();

  const writeSnapshot = (snapshot) => {
    response.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  };

  writeSnapshot(store.getSnapshot());

  const unsubscribe = store.subscribe(writeSnapshot);
  const heartbeat = setInterval(() => {
    response.write(": heartbeat\n\n");
  }, 15_000);

  request.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    response.end();
  });
});

app.get("/api/device/status", async (_request, response) => {
  try {
    response.json({
      ok: true,
      ...(await deviceService.getStatus())
    });
  } catch (error) {
    respondWithError(response, error);
  }
});

app.get("/api/device/settings", (_request, response) => {
  response.json({
    ok: true,
    settings: deviceSettingsStore.get()
  });
});

app.get("/api/device/ticker-tape", async (_request, response) => {
  const settings = deviceSettingsStore.get();
  const symbols = settings.tickerTapeSymbols;

  if (settings.tickerTapePosition === "hide" || symbols.length === 0) {
    response.json({
      ok: true,
      position: settings.tickerTapePosition,
      items: []
    });
    return;
  }

  let quotes = [];
  let errors = [];

  try {
    quotes = await fetchQuotes(symbols, { existingQuoteCount: 0 });
  } catch (error) {
    errors = [error instanceof Error ? error.message : "Ticker tape quote refresh failed."];
  }

  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

  response.json({
    ok: true,
    position: settings.tickerTapePosition,
    items: symbols.map((symbol) => buildTickerTapeItem(symbol, bySymbol.get(symbol))),
    errors
  });
});

app.post("/api/device/settings", async (request, response) => {
  try {
    response.json({
      ok: true,
      settings: await deviceService.updateSettings(request.body ?? {})
    });
  } catch (error) {
    respondWithError(response, error);
  }
});

app.get("/api/device/wifi/networks", async (request, response) => {
  try {
    response.json({
      ok: true,
      networks: await deviceService.listWifiNetworks({
        country: `${request.query.country ?? ""}`
      })
    });
  } catch (error) {
    respondWithError(response, error);
  }
});

app.post("/api/device/wifi/connect", async (request, response) => {
  try {
    response.json({
      ok: true,
      ...(await deviceService.connectWifi(request.body ?? {}))
    });
  } catch (error) {
    respondWithError(response, error);
  }
});

app.post("/api/device/actions/restart-app", async (_request, response) => {
  try {
    await deviceService.restartApp();
    response.json({ ok: true });
  } catch (error) {
    respondWithError(response, error);
  }
});

app.post("/api/device/actions/sync-now", async (_request, response) => {
  try {
    response.json({
      ok: true,
      ...(await syncMarketDataNow("kiosk requested sync"))
    });
  } catch (error) {
    respondWithError(response, error);
  }
});

app.post("/api/device/actions/restart-kiosk", async (_request, response) => {
  try {
    await deviceService.restartKiosk();
    response.json({ ok: true });
  } catch (error) {
    respondWithError(response, error);
  }
});

app.post("/api/device/actions/reboot", async (_request, response) => {
  try {
    await deviceService.rebootDevice();
    response.json({ ok: true });
  } catch (error) {
    respondWithError(response, error);
  }
});

app.get("*", (_request, response) => {
  response.sendFile(path.join(rootDir, "public", "index.html"));
});

await deviceService.prime().catch((error) => {
  console.error("Device settings prime failed.", error);
});

app.listen(port, host, () => {
  console.log(`Heat map board listening on http://${host}:${port}`);
});

setTimeout(() => {
  syncAtStartupIfWifiConnected().catch((error) => {
    console.error("Startup Wi-Fi sync failed.", error);
  });
}, 0).unref?.();

for (const store of stores.values()) {
  store.start();
}

setTimeout(() => {
  Promise.allSettled(
    markets.map(async (market) => {
      const store = stores.get(market.id);

      try {
        await store.prime();
      } catch (error) {
        console.error(`Initial quote refresh failed for ${market.id}. Serving placeholder data.`, error);
      }
    })
  ).catch((error) => {
    console.error("Market store startup failed.", error);
  });
}, startupQuoteRefreshDelayMs()).unref?.();

setTimeout(() => {
  universeSyncService
    .prime({ lastSyncedAt })
    .catch((error) => {
      console.error("Universe sync prime failed.", error);
    })
    .finally(() => {
      universeSyncService.start();
    });
}, Math.max(0, universeStartupDelayMs)).unref?.();
