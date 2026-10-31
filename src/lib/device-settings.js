import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DEVICE_SETTINGS = {
  startupMarket: "sp500",
  holdToOpenMs: 1200,
  tickerTapePosition: "hide",
  tickerTapeSymbols: [],
  wifiCountry: "",
  lastWifiSsid: "",
  showHeaderLastSync: true,
  showHeaderWifi: false,
  showHeaderLocalTime: false
};

const TICKER_TAPE_SYMBOL_LIMIT = 500;
const ALLOWED_TICKER_TAPE_POSITIONS = new Set(["top", "bottom", "hide"]);

function normalizeTickerSymbol(symbol) {
  return `${symbol ?? ""}`
    .trim()
    .toUpperCase()
    .replaceAll(".", "-")
    .replace(/[^A-Z0-9^/-]/g, "");
}

function sanitizeTickerTapeSymbols(value) {
  const rawSymbols = Array.isArray(value)
    ? value
    : `${value ?? ""}`
        .split(/[\s,]+/)
        .filter(Boolean);

  const uniqueSymbols = [];
  const seen = new Set();

  for (const rawSymbol of rawSymbols) {
    const symbol = normalizeTickerSymbol(rawSymbol);

    if (!symbol || seen.has(symbol)) {
      continue;
    }

    seen.add(symbol);
    uniqueSymbols.push(symbol);

    if (uniqueSymbols.length >= TICKER_TAPE_SYMBOL_LIMIT) {
      break;
    }
  }

  return uniqueSymbols;
}

function sanitizeTickerTapePosition(value) {
  return ALLOWED_TICKER_TAPE_POSITIONS.has(value) ? value : DEFAULT_DEVICE_SETTINGS.tickerTapePosition;
}

function clampHoldMs(value) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_DEVICE_SETTINGS.holdToOpenMs;
  }

  return Math.min(3000, Math.max(600, parsed));
}

function sanitizeWifiCountry(value) {
  const normalized = `${value ?? ""}`.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
}

function sanitizeWifiSsid(value) {
  return `${value ?? ""}`.trim().slice(0, 64);
}

function sanitizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

async function syncDirectory(directory) {
  let handle;

  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch {
    // Directory fsync is best-effort and is not supported on every filesystem.
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function writeJsonAtomically(file, payload) {
  const directory = path.dirname(file);
  const tempFile = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  let handle;

  await mkdir(directory, { recursive: true });

  try {
    handle = await open(tempFile, "w");
    await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tempFile, file);
    await syncDirectory(directory);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(tempFile, { force: true }).catch(() => {});
    throw error;
  }
}

export class DeviceSettingsStore {
  constructor({ file, allowedMarketIds, logger = console }) {
    this.file = file;
    this.allowedMarketIds = new Set(allowedMarketIds);
    this.logger = logger;
    this.settings = { ...DEFAULT_DEVICE_SETTINGS };
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8"));
      this.settings = this.#sanitize(parsed);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        this.logger.warn("Device settings load failed. Using defaults.", error);
      }
      this.settings = { ...DEFAULT_DEVICE_SETTINGS };
    }

    return this.get();
  }

  get() {
    return {
      ...this.settings,
      tickerTapeSymbols: [...this.settings.tickerTapeSymbols]
    };
  }

  async update(patch) {
    this.settings = this.#sanitize({
      ...this.settings,
      ...patch
    });

    await writeJsonAtomically(this.file, this.settings);
    return this.get();
  }

  #sanitize(candidate) {
    const startupMarket = this.allowedMarketIds.has(candidate?.startupMarket)
      ? candidate.startupMarket
      : DEFAULT_DEVICE_SETTINGS.startupMarket;

    return {
      startupMarket,
      holdToOpenMs: clampHoldMs(candidate?.holdToOpenMs),
      tickerTapePosition: sanitizeTickerTapePosition(candidate?.tickerTapePosition),
      tickerTapeSymbols: sanitizeTickerTapeSymbols(candidate?.tickerTapeSymbols),
      wifiCountry: sanitizeWifiCountry(candidate?.wifiCountry),
      lastWifiSsid: sanitizeWifiSsid(candidate?.lastWifiSsid),
      showHeaderLastSync: sanitizeBoolean(
        candidate?.showHeaderLastSync,
        DEFAULT_DEVICE_SETTINGS.showHeaderLastSync
      ),
      showHeaderWifi: sanitizeBoolean(candidate?.showHeaderWifi, DEFAULT_DEVICE_SETTINGS.showHeaderWifi),
      showHeaderLocalTime: sanitizeBoolean(
        candidate?.showHeaderLocalTime,
        DEFAULT_DEVICE_SETTINGS.showHeaderLocalTime
      )
    };
  }
}
