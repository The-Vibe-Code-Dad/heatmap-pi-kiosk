import { buildHeatmapSnapshot, buildPlaceholderSnapshot, markSnapshotStale } from "./heatmap.js";
import { marketRefreshCadenceMs, nextMarketRefreshDelayMs } from "./market-refresh-schedule.js";
import { fetchIndexQuote, fetchQuotes } from "./quote-client.js";

const OPENING_BURST_QUOTE_MAX_AGE_MS = 0;

export class HeatmapStore {
  constructor({
    market,
    refreshMs = 60_000,
    fetcher = fetchQuotes,
    indexFetcher = fetchIndexQuote,
    refreshCadenceFor = marketRefreshCadenceMs,
    refreshDelayFor = nextMarketRefreshDelayMs,
    logger = console
  }) {
    this.market = market;
    this.companies = market.companies;
    this.symbols = this.companies.map((company) => company.symbol);
    this.refreshMs = refreshMs;
    this.fetcher = fetcher;
    this.indexFetcher = indexFetcher;
    this.refreshCadenceFor = refreshCadenceFor;
    this.refreshDelayFor = refreshDelayFor;
    this.logger = logger;
    this.quoteCache = new Map();
    this.snapshot = buildPlaceholderSnapshot(this.companies, { refreshMs, market });
    this.listeners = new Set();
    this.timer = null;
    this.refreshPromise = null;
  }

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async prime() {
    await this.refresh();
  }

  async updateUniverse() {
    if (this.refreshPromise !== null) {
      try {
        await this.refreshPromise;
      } catch {
        // Ignore the in-flight refresh error and continue with the roster swap.
      }
    }

    this.companies = this.market.companies;
    this.symbols = this.companies.map((company) => company.symbol);

    const allowedSymbols = new Set(this.symbols);

    for (const symbol of [...this.quoteCache.keys()]) {
      if (!allowedSymbols.has(symbol)) {
        this.quoteCache.delete(symbol);
      }
    }

    const previousSnapshot = this.snapshot;
    const cachedQuotes = [...this.quoteCache.values()].filter((quote) => allowedSymbols.has(quote.symbol));

    this.snapshot =
      cachedQuotes.length === 0
        ? buildPlaceholderSnapshot(this.companies, {
            refreshMs: this.refreshMs,
            market: this.market
          })
        : buildHeatmapSnapshot(this.companies, cachedQuotes, {
            market: this.market,
            refreshMs: this.refreshMs,
            previousSnapshot
          });

    this.#emit();
    await this.refresh();
  }

  start() {
    if (this.timer !== null) {
      return;
    }

    this.#scheduleNextRefresh();
  }

  stop() {
    if (this.timer === null) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }

  async refresh() {
    if (this.refreshPromise !== null) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.#refreshInternal().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  async #refreshInternal() {
    const cadenceMs = this.refreshCadenceFor(new Date(), this.refreshMs);
    const quoteOptions = {
      existingQuoteCount: this.quoteCache.size
    };

    if (cadenceMs === 1_000) {
      quoteOptions.maxQuoteAgeMs = OPENING_BURST_QUOTE_MAX_AGE_MS;
    }

    try {
      const [quotes, indexQuote] = await Promise.all([
        this.fetcher(this.symbols, quoteOptions),
        this.indexFetcher(this.market.index.quoteSymbol, quoteOptions).catch((error) => {
          this.logger.warn("Index refresh failed.", error);
          return null;
        })
      ]);

      for (const quote of quotes) {
        this.quoteCache.set(quote.symbol, quote);
      }

      this.snapshot = buildHeatmapSnapshot(
        this.companies,
        [...this.quoteCache.values()],
        indexQuote,
        {
          market: this.market,
          refreshMs: this.refreshMs,
          previousSnapshot: this.snapshot
        }
      );
    } catch (error) {
      this.logger.error("Heat map refresh failed.", error);
      this.snapshot = markSnapshotStale(this.snapshot, error);
    }

    this.#emit();
    return this.snapshot;
  }

  #emit() {
    for (const listener of this.listeners) {
      try {
        listener(this.snapshot);
      } catch (error) {
        this.logger.error("Heat map subscriber failed.", error);
      }
    }
  }

  #scheduleNextRefresh() {
    const delayMs = this.refreshDelayFor(new Date(), this.refreshMs);

    this.timer = setTimeout(() => {
      this.timer = null;
      this.#runScheduledRefresh();
    }, delayMs);

    this.timer.unref?.();
  }

  #runScheduledRefresh() {
    if (this.listeners.size > 0) {
      this.refresh().catch((error) => {
        this.logger.error("Unexpected refresh failure", error);
      });
    }

    this.#scheduleNextRefresh();
  }
}
