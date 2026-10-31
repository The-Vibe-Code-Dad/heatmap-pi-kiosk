import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

const CACHE_VERSION = 1;
const DEFAULT_TIME_ZONE = "America/New_York";
const DEFAULT_SYNC_HOUR = 9;
const DEFAULT_SYNC_MINUTE = 0;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const WEEKEND_DAYS = new Set(["Sat", "Sun"]);
const WIKIPEDIA_RAW_URL = "https://en.wikipedia.org/w/index.php";

const zonedFormatterCache = new Map();

function normalizeForYahoo(symbol) {
  return symbol.replaceAll(".", "-");
}

function displaySymbolFor(symbol) {
  const yahooSymbol = normalizeForYahoo(symbol);
  return yahooSymbol === symbol ? undefined : symbol;
}

function parseDateLabel(value) {
  const parsed = new Date(`${value} 00:00:00 UTC`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

function cleanWikiCell(value) {
  return value
    .replace(/<ref[^>]*>.*?<\/ref>/gsi, "")
    .replace(/<!--.*?-->/gs, "")
    .replace(/\{\{[^|}]+\|([^|}]+)(?:\|[^}]*)?\}\}/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWikiTableRows(source, tableStartPattern) {
  const start = source.indexOf(tableStartPattern);

  if (start < 0) {
    throw new Error(`Table start not found: ${tableStartPattern}`);
  }

  const end = source.indexOf("|}", start);

  if (end < 0) {
    throw new Error(`Table end not found for pattern: ${tableStartPattern}`);
  }

  return source.slice(start, end).split("|-\n").slice(1);
}

function parseDelimitedRow(row, { rowScopePrefix = /^!\s*scope="row"\|\s*/, headerPrefix = /^!\s*/, cellPrefix = /^\|\s*/ } = {}) {
  const lines = row
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") || line.startsWith("!"));
  const cells = [];

  for (const line of lines) {
    const normalized = line
      .replace(rowScopePrefix, "")
      .replace(headerPrefix, "")
      .replace(cellPrefix, "");

    cells.push(...normalized.split("||").map((cell) => cleanWikiCell(cell)));
  }

  return cells;
}

function parseVerticalRow(row) {
  return row
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .map((line) => cleanWikiCell(line.replace(/^\|\s*/, "")));
}

function compareCompanySort(left, right) {
  return (left.displaySymbol ?? left.symbol).localeCompare(right.displaySymbol ?? right.symbol);
}

function parseNasdaq100Universe(source, fallbackCompanies) {
  const baseRows = parseWikiTableRows(source, '{| class="wikitable sortable" id="constituents"');
  const changesRows = parseWikiTableRows(source, '{| class="wikitable sortable" id="changes"');
  const fallbackBySymbol = new Map(fallbackCompanies.map((company) => [company.symbol, company]));
  const companies = [];

  for (const row of baseRows) {
    const cells = parseDelimitedRow(row);

    if (cells.length < 3 || cells[0] === "Ticker") {
      continue;
    }

    const rawSymbol = cells[0];
    const symbol = normalizeForYahoo(rawSymbol);

    companies.push({
      symbol,
      displaySymbol: displaySymbolFor(rawSymbol),
      name: cells[1],
      sector: cells[2]
    });
  }

  const bySymbol = new Map(companies.map((company) => [company.symbol, company]));
  const currentTableDateMatch = source.match(/This table is current as of the open of trading on ([A-Za-z]+ \d{1,2}, \d{4})\./);
  const currentTableEffectiveDate =
    currentTableDateMatch === null ? null : parseDateLabel(currentTableDateMatch[1]);
  const appliedChangeDates = [];

  for (const row of changesRows) {
    const cells = parseVerticalRow(row);

    if (cells.length < 6) {
      continue;
    }

    const effectiveDate = parseDateLabel(cells[0]);

    if (effectiveDate === null) {
      continue;
    }

    if (currentTableEffectiveDate !== null && effectiveDate <= currentTableEffectiveDate) {
      continue;
    }

    const rawAddedSymbol = cells[1];
    const addedName = cells[2];
    const rawRemovedSymbol = cells[3];

    if (rawRemovedSymbol) {
      bySymbol.delete(normalizeForYahoo(rawRemovedSymbol));
    }

    if (rawAddedSymbol) {
      const symbol = normalizeForYahoo(rawAddedSymbol);
      const fallbackCompany = fallbackBySymbol.get(symbol);

      bySymbol.set(symbol, {
        symbol,
        displaySymbol: displaySymbolFor(rawAddedSymbol),
        name: fallbackCompany?.name ?? addedName ?? rawAddedSymbol,
        sector: fallbackCompany?.sector ?? "Other"
      });
    }

    appliedChangeDates.push(effectiveDate);
  }

  const nextCompanies = [...bySymbol.values()].sort(compareCompanySort);
  const latestChangeDate =
    appliedChangeDates.length === 0
      ? currentTableEffectiveDate
      : appliedChangeDates.sort().at(-1);

  return {
    companies: nextCompanies,
    universeEffectiveDate: latestChangeDate ?? new Date().toISOString().slice(0, 10),
    universeSourceNote:
      currentTableEffectiveDate === null
        ? "Auto-synced from the Nasdaq-100 Wikipedia current-components table."
        : `Auto-synced from the Nasdaq-100 Wikipedia current-components table dated ${currentTableEffectiveDate}, with component changes applied through ${latestChangeDate ?? currentTableEffectiveDate}.`
  };
}

function parseDow30Universe(source) {
  const rows = parseWikiTableRows(source, '{| class="wikitable sortable sticky-header" id="constituents"');
  const companies = [];

  for (const row of rows) {
    const cells = parseDelimitedRow(row);

    if (cells.length < 4 || cells[0].includes("Company") || cells[2].includes("Symbol")) {
      continue;
    }

    const rawSymbol = cells[2];

    companies.push({
      symbol: normalizeForYahoo(rawSymbol),
      displaySymbol: displaySymbolFor(rawSymbol),
      name: cells[0],
      sector: cells[3]
    });
  }

  const effectiveMatch = source.match(/\{\{As of\|(\d{4})\|([A-Za-z]+|\d{1,2})\|(\d{1,2})/);
  const effectiveDate =
    effectiveMatch === null
      ? new Date().toISOString().slice(0, 10)
      : parseDateLabel(`${effectiveMatch[2]} ${effectiveMatch[3]}, ${effectiveMatch[1]}`) ??
        new Date().toISOString().slice(0, 10);

  return {
    companies,
    universeEffectiveDate: effectiveDate,
    universeSourceNote: `Auto-synced from the Dow Jones Industrial Average Wikipedia components table dated ${effectiveDate}.`
  };
}

function parseSp500Universe(source) {
  const rows = parseWikiTableRows(
    source,
    '{| class="wikitable sortable mw-collapsible sticky-header" id="constituents"'
  );
  const companies = [];
  const excludedSymbols = new Set(["GOOG", "FOX", "NWS"]);

  for (const row of rows) {
    const cells = parseDelimitedRow(row);

    if (cells.length < 3 || cells[0].includes("Ticker symbol")) {
      continue;
    }

    const rawSymbol = cells[0];

    if (excludedSymbols.has(rawSymbol)) {
      continue;
    }

    companies.push({
      symbol: normalizeForYahoo(rawSymbol),
      displaySymbol: displaySymbolFor(rawSymbol),
      name: cells[1],
      sector: cells[2]
    });
  }

  const effectiveDate = new Date().toISOString().slice(0, 10);

  return {
    companies,
    universeEffectiveDate: effectiveDate,
    universeSourceNote:
      "Auto-synced from the current Wikipedia List of S&P 500 companies table, collapsed to 500 tiles by keeping GOOGL, FOXA, and NWSA instead of their duplicate share classes."
  };
}

async function fetchWikipediaRawPage(pageTitle) {
  const url = new URL(WIKIPEDIA_RAW_URL);
  url.searchParams.set("title", pageTitle);
  url.searchParams.set("action", "raw");

  const response = await fetch(url, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "Mozilla/5.0 HeatMapUniverseSync/1.0"
    },
    signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Wikipedia raw page for ${pageTitle} responded with HTTP ${response.status}.`);
  }

  return response.text();
}

async function fetchUniverseFromSource(market) {
  if (market.source?.kind !== "wikipedia-raw") {
    throw new Error(`Unsupported universe source for ${market.id}.`);
  }

  const sourceText = await fetchWikipediaRawPage(market.source.pageTitle);
  let parsed;

  if (market.source.parser === "nasdaq100") {
    parsed = parseNasdaq100Universe(sourceText, market.companies);
  } else if (market.source.parser === "dow30") {
    parsed = parseDow30Universe(sourceText);
  } else if (market.source.parser === "sp500") {
    parsed = parseSp500Universe(sourceText);
  } else {
    throw new Error(`Unknown universe parser ${market.source.parser}.`);
  }

  if (!isExpectedCompanyCount(parsed.companies.length, market.source)) {
    throw new Error(
      `Universe sync for ${market.id} expected ${expectedCompanyCountLabel(market.source)} companies but received ${parsed.companies.length}.`
    );
  }

  return parsed;
}

function expectedCompanyCounts(source) {
  if (Array.isArray(source?.expectedCounts)) {
    return source.expectedCounts;
  }

  return [source?.expectedCount].filter((count) => Number.isInteger(count));
}

function expectedCompanyCountLabel(source) {
  return expectedCompanyCounts(source).join(" or ");
}

function isExpectedCompanyCount(count, source) {
  return expectedCompanyCounts(source).includes(count);
}

function companiesSignature(companies) {
  return companies
    .map((company) =>
      [company.symbol, company.displaySymbol ?? "", company.name, company.sector].join("|")
    )
    .join("\n");
}

function marketToCacheEntry(market) {
  return {
    companies: market.companies,
    universeEffectiveDate: market.universeEffectiveDate,
    universeSourceNote: market.universeSourceNote
  };
}

function isValidCachedCompany(company) {
  return (
    company &&
    typeof company.symbol === "string" &&
    company.symbol.trim() !== "" &&
    typeof company.name === "string" &&
    company.name.trim() !== "" &&
    typeof company.sector === "string" &&
    company.sector.trim() !== "" &&
    (company.displaySymbol === undefined || typeof company.displaySymbol === "string")
  );
}

function isValidCachedEntry(entry, source) {
  return (
    entry &&
    Array.isArray(entry.companies) &&
    isExpectedCompanyCount(entry.companies.length, source) &&
    entry.companies.every(isValidCachedCompany) &&
    typeof entry.universeEffectiveDate === "string" &&
    typeof entry.universeSourceNote === "string"
  );
}

export function getZonedParts(date, timeZone = DEFAULT_TIME_ZONE) {
  const formatter =
    zonedFormatterCache.get(timeZone) ??
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  zonedFormatterCache.set(timeZone, formatter);
  const values = {};

  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    weekday: values.weekday,
    year: Number.parseInt(values.year, 10),
    month: Number.parseInt(values.month, 10),
    day: Number.parseInt(values.day, 10),
    hour: Number.parseInt(values.hour, 10),
    minute: Number.parseInt(values.minute, 10),
    second: Number.parseInt(values.second, 10)
  };
}

function zonedDateToUtc(parts, timeZone = DEFAULT_TIME_ZONE) {
  const guess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0)
  );
  const resolved = getZonedParts(guess, timeZone);
  const targetUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0
  );
  const resolvedUtc = Date.UTC(
    resolved.year,
    resolved.month - 1,
    resolved.day,
    resolved.hour,
    resolved.minute,
    resolved.second
  );

  return new Date(guess.getTime() + (targetUtc - resolvedUtc));
}

function nextDayParts(parts) {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + 24 * 60 * 60 * 1000);

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate()
  };
}

function isBusinessDay(weekday) {
  return !WEEKEND_DAYS.has(weekday);
}

export function getNextUniverseSyncTime(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  let candidateDate = getZonedParts(now, timeZone);

  while (true) {
    const candidate = zonedDateToUtc(
      {
        year: candidateDate.year,
        month: candidateDate.month,
        day: candidateDate.day,
        hour: DEFAULT_SYNC_HOUR,
        minute: DEFAULT_SYNC_MINUTE,
        second: 0
      },
      timeZone
    );
    const candidateParts = getZonedParts(candidate, timeZone);

    if (isBusinessDay(candidateParts.weekday) && candidate > now) {
      return candidate;
    }

    candidateDate = nextDayParts(candidateDate);
  }
}

export function shouldRunUniverseSyncNow(lastSyncedAt, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const nowParts = getZonedParts(now, timeZone);

  if (!isBusinessDay(nowParts.weekday)) {
    return false;
  }

  const todaySyncTime = zonedDateToUtc(
    {
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
      hour: DEFAULT_SYNC_HOUR,
      minute: DEFAULT_SYNC_MINUTE,
      second: 0
    },
    timeZone
  );

  if (now < todaySyncTime) {
    return false;
  }

  if (!lastSyncedAt) {
    return true;
  }

  return new Date(lastSyncedAt) < todaySyncTime;
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

export async function loadUniverseCache({ markets, cacheFile, logger = console }) {
  try {
    const parsed = JSON.parse(await readFile(cacheFile, "utf8"));

    if (parsed.version !== CACHE_VERSION || typeof parsed.markets !== "object" || parsed.markets === null) {
      return { lastSyncedAt: null };
    }

    for (const market of markets) {
      const cachedEntry = parsed.markets[market.id];

      if (!isValidCachedEntry(cachedEntry, market.source)) {
        continue;
      }

      market.companies = cachedEntry.companies;
      market.universeEffectiveDate = cachedEntry.universeEffectiveDate;
      market.universeSourceNote = cachedEntry.universeSourceNote;
    }

    return {
      lastSyncedAt: typeof parsed.syncedAt === "string" ? parsed.syncedAt : null
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      logger.warn("Universe cache load failed. Using bundled market rosters.", error);
    }

    return { lastSyncedAt: null };
  }
}

async function writeUniverseCache({ markets, cacheFile, syncedAt }) {
  const payload = {
    version: CACHE_VERSION,
    syncedAt,
    markets: Object.fromEntries(markets.map((market) => [market.id, marketToCacheEntry(market)]))
  };

  await writeJsonAtomically(cacheFile, payload);
}

export class UniverseSyncService {
  constructor({ markets, stores, cacheFile, logger = console, timeZone = DEFAULT_TIME_ZONE }) {
    this.markets = markets;
    this.stores = stores;
    this.cacheFile = cacheFile;
    this.logger = logger;
    this.timeZone = timeZone;
    this.lastSyncedAt = null;
    this.timer = null;
    this.syncPromise = null;
  }

  async prime({ lastSyncedAt = null } = {}) {
    if (
      this.lastSyncedAt === null ||
      (lastSyncedAt !== null && new Date(lastSyncedAt) > new Date(this.lastSyncedAt))
    ) {
      this.lastSyncedAt = lastSyncedAt;
    }

    if (shouldRunUniverseSyncNow(this.lastSyncedAt, new Date(), this.timeZone)) {
      await this.syncNow("startup catch-up");
    }
  }

  start() {
    if (this.timer !== null) {
      return;
    }

    this.#scheduleNext();
  }

  stop() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async syncNow(reason = "manual") {
    if (this.syncPromise !== null) {
      return this.syncPromise;
    }

    this.syncPromise = this.#syncInternal(reason).finally(() => {
      this.syncPromise = null;
    });

    return this.syncPromise;
  }

  async #syncInternal(reason) {
    const updates = [];

    for (const market of this.markets) {
      try {
        updates.push({
          market,
          ...(await fetchUniverseFromSource(market))
        });
      } catch (error) {
        this.logger.warn(`Universe sync skipped ${market.id}.`, error);
      }
    }

    for (const update of updates) {
      const currentSignature = companiesSignature(update.market.companies);
      const nextSignature = companiesSignature(update.companies);

      update.market.companies = update.companies;
      update.market.universeEffectiveDate = update.universeEffectiveDate;
      update.market.universeSourceNote = update.universeSourceNote;

      if (currentSignature !== nextSignature) {
        this.logger.info(
          `Universe sync refreshed ${update.market.id} with ${update.companies.length} companies (${reason}).`
        );
      }

      const store = this.stores.get(update.market.id);

      if (store) {
        await store.updateUniverse();
      }
    }

    if (updates.length > 0) {
      this.lastSyncedAt = new Date().toISOString();
      await writeUniverseCache({
        markets: this.markets,
        cacheFile: this.cacheFile,
        syncedAt: this.lastSyncedAt
      });
    }

    this.#scheduleNext();
  }

  #scheduleNext() {
    this.stop();

    const nextSyncTime = getNextUniverseSyncTime(new Date(), this.timeZone);
    const delayMs = Math.max(1_000, nextSyncTime.getTime() - Date.now());

    this.timer = setTimeout(() => {
      this.syncNow("scheduled 30 minutes before market open").catch((error) => {
        this.logger.error("Universe sync run failed.", error);
        this.#scheduleNext();
      });
    }, delayMs);
  }
}
