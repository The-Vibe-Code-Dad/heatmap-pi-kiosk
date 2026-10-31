const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_REFRESH_BATCH_SIZE = 34;
const DEFAULT_WARMUP_BATCH_SIZE = 34;
const DEFAULT_SYMBOL_DELAY_MS = 25;
const DEFAULT_MAX_PARALLEL_REQUESTS = 6;
const DEFAULT_QUOTE_TTL_MS = 60_000;
const DEFAULT_RETRY_BASE_DELAY_MS = 15_000;
const DEFAULT_RETRY_MAX_DELAY_MS = 5 * 60_000;
const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const DEFAULT_INDEX_SYMBOL = "^NDX";

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replaceAll(",", "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function timeoutMs() {
  const parsed = Number.parseInt(process.env.QUOTE_TIMEOUT_MS ?? `${DEFAULT_TIMEOUT_MS}`, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_TIMEOUT_MS;
}

function refreshBatchSize() {
  const parsed = Number.parseInt(
    process.env.REFRESH_BATCH_SIZE ?? `${DEFAULT_REFRESH_BATCH_SIZE}`,
    10
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REFRESH_BATCH_SIZE;
}

function warmupBatchSize() {
  const parsed = Number.parseInt(
    process.env.WARMUP_BATCH_SIZE ?? `${DEFAULT_WARMUP_BATCH_SIZE}`,
    10
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WARMUP_BATCH_SIZE;
}

function symbolDelayMs() {
  const parsed = Number.parseInt(process.env.SYMBOL_DELAY_MS ?? `${DEFAULT_SYMBOL_DELAY_MS}`, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SYMBOL_DELAY_MS;
}

function maxParallelRequests() {
  const parsed = Number.parseInt(
    process.env.MAX_PARALLEL_REQUESTS ?? `${DEFAULT_MAX_PARALLEL_REQUESTS}`,
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_PARALLEL_REQUESTS;
}

function quoteTtlMs() {
  const parsed = Number.parseInt(process.env.QUOTE_CACHE_TTL_MS ?? `${DEFAULT_QUOTE_TTL_MS}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUOTE_TTL_MS;
}

function retryBaseDelayMs() {
  const parsed = Number.parseInt(
    process.env.QUOTE_RETRY_BASE_DELAY_MS ?? `${DEFAULT_RETRY_BASE_DELAY_MS}`,
    10
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETRY_BASE_DELAY_MS;
}

function retryMaxDelayMs() {
  const parsed = Number.parseInt(
    process.env.QUOTE_RETRY_MAX_DELAY_MS ?? `${DEFAULT_RETRY_MAX_DELAY_MS}`,
    10
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETRY_MAX_DELAY_MS;
}

function detectMarketState(meta) {
  const periods = meta?.currentTradingPeriod;
  const now = parseNumber(meta?.regularMarketTime) ?? Math.floor(Date.now() / 1000);

  if (!periods?.regular) {
    return "REGULAR";
  }

  if (periods.pre && now >= periods.pre.start && now < periods.pre.end) {
    return "PRE";
  }

  if (now >= periods.regular.start && now < periods.regular.end) {
    return "REGULAR";
  }

  if (periods.post && now >= periods.post.start && now < periods.post.end) {
    return "POST";
  }

  return "CLOSED";
}

async function requestChart(symbol) {
  const url = new URL(`${YAHOO_CHART_BASE_URL}/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", "1d");
  url.searchParams.set("includePrePost", "true");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 NasdaqHeatmap/1.0"
    },
    signal: AbortSignal.timeout(timeoutMs())
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart endpoint for ${symbol} responded with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];

  if (!result) {
    throw new Error(`Yahoo chart endpoint for ${symbol} returned an unexpected payload.`);
  }

  return result;
}

function latestClose(result) {
  const closes = result?.indicators?.quote?.[0]?.close;

  if (!Array.isArray(closes)) {
    return null;
  }

  for (let index = closes.length - 1; index >= 0; index -= 1) {
    const value = parseNumber(closes[index]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

export async function fetchSymbolQuote(symbol, { requestChartImpl = requestChart } = {}) {
  const result = await requestChartImpl(symbol);
  const meta = result.meta ?? {};
  const price = parseNumber(meta.regularMarketPrice) ?? latestClose(result);
  const previousClose = parseNumber(meta.chartPreviousClose) ?? parseNumber(meta.previousClose);
  const change = price !== null && previousClose !== null ? price - previousClose : 0;
  const changePercent =
    price !== null && previousClose !== null && previousClose !== 0
      ? (change / previousClose) * 100
      : 0;

  return {
    symbol,
    currency: meta.currency ?? "USD",
    marketState: detectMarketState(meta),
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketVolume: parseNumber(meta.regularMarketVolume),
    regularMarketTime: parseNumber(meta.regularMarketTime) ?? Math.floor(Date.now() / 1000),
    marketCap: 1,
    regularMarketPreviousClose: previousClose
  };
}

export class SharedQuoteService {
  constructor({
    logger = console,
    now = () => Date.now(),
    requestChartImpl = requestChart,
    refreshBatchSize: refreshBatchSizeValue = refreshBatchSize(),
    warmupBatchSize: warmupBatchSizeValue = warmupBatchSize(),
    maxParallelRequests: maxParallelRequestsValue = maxParallelRequests(),
    symbolDelayMs: symbolDelayMsValue = symbolDelayMs(),
    quoteTtlMs: quoteTtlMsValue = quoteTtlMs(),
    retryBaseDelayMs: retryBaseDelayMsValue = retryBaseDelayMs(),
    retryMaxDelayMs: retryMaxDelayMsValue = retryMaxDelayMs()
  } = {}) {
    this.logger = logger;
    this.now = now;
    this.requestChartImpl = requestChartImpl;
    this.refreshBatchSize = refreshBatchSizeValue;
    this.warmupBatchSize = warmupBatchSizeValue;
    this.maxParallelRequests = maxParallelRequestsValue;
    this.symbolDelayMs = symbolDelayMsValue;
    this.quoteTtlMs = quoteTtlMsValue;
    this.retryBaseDelayMs = retryBaseDelayMsValue;
    this.retryMaxDelayMs = retryMaxDelayMsValue;
    this.liveCursor = 0;
    this.quoteCache = new Map();
    this.failureCache = new Map();
    this.inFlight = new Map();
    this.queue = [];
    this.activeRequests = 0;
    this.queueTimer = null;
    this.nextLaunchAt = 0;
  }

  async fetchIndexQuote(symbol = DEFAULT_INDEX_SYMBOL, { maxQuoteAgeMs = this.quoteTtlMs } = {}) {
    const nowMs = this.now();
    const cached = this.quoteCache.get(symbol);

    if (cached && this.#isFresh(cached, nowMs, maxQuoteAgeMs)) {
      return cached.quote;
    }

    if (!this.#canRetry(symbol, nowMs)) {
      if (cached) {
        return cached.quote;
      }

      const failure = this.failureCache.get(symbol);
      throw new Error(failure?.message ?? `Quote retry for ${symbol} is temporarily paused.`);
    }

    try {
      return await this.#loadQuote(symbol);
    } catch (error) {
      if (cached) {
        this.logger.warn(`Serving cached index quote for ${symbol}.`, error);
        return cached.quote;
      }

      throw error;
    }
  }

  async fetchQuotes(symbols, { existingQuoteCount = 0, maxQuoteAgeMs = this.quoteTtlMs } = {}) {
    const uniqueSymbols = [...new Set(symbols)];
    const selectedSymbols = this.#selectSymbolsToRefresh(uniqueSymbols, existingQuoteCount, maxQuoteAgeMs);
    const errors = [];

    await Promise.all(
      selectedSymbols.map(async (symbol) => {
        try {
          await this.#loadQuote(symbol);
        } catch (error) {
          errors.push(`${symbol}: ${error instanceof Error ? error.message : "request failed"}`);
        }
      })
    );

    const quotes = uniqueSymbols
      .map((symbol) => this.quoteCache.get(symbol)?.quote ?? null)
      .filter(Boolean);

    if (quotes.length === 0) {
      throw new Error(errors[0] ?? "Failed to fetch quotes.");
    }

    if (errors.length > 0) {
      this.logger.warn(`Quote fetch skipped ${errors.length} symbols.`);
    }

    return quotes;
  }

  #selectSymbolsToRefresh(symbols, existingQuoteCount, maxQuoteAgeMs) {
    const nowMs = this.now();
    const missing = [];
    const stale = [];

    for (const symbol of symbols) {
      const entry = this.quoteCache.get(symbol);

      if (!entry) {
        if (this.#canRetry(symbol, nowMs)) {
          missing.push(symbol);
        }
        continue;
      }

      if (!this.#isFresh(entry, nowMs, maxQuoteAgeMs) && this.#canRetry(symbol, nowMs)) {
        stale.push(symbol);
      }
    }

    const refreshLimit =
      existingQuoteCount === 0
        ? Math.min(this.warmupBatchSize, symbols.length)
        : Math.min(this.refreshBatchSize, symbols.length);
    const selected = missing.slice(0, refreshLimit);

    if (selected.length < refreshLimit) {
      selected.push(...this.#pickWindow(stale, refreshLimit - selected.length));
    }

    return selected;
  }

  #pickWindow(symbols, size) {
    if (size <= 0 || symbols.length === 0) {
      return [];
    }

    if (symbols.length <= size) {
      return symbols;
    }

    const start = this.liveCursor % symbols.length;
    const selected = [];

    for (let offset = 0; offset < size; offset += 1) {
      selected.push(symbols[(start + offset) % symbols.length]);
    }

    this.liveCursor = (start + size) % symbols.length;
    return selected;
  }

  #isFresh(entry, nowMs, maxQuoteAgeMs = this.quoteTtlMs) {
    return nowMs - entry.fetchedAt < maxQuoteAgeMs;
  }

  #canRetry(symbol, nowMs) {
    const failure = this.failureCache.get(symbol);
    return !failure || failure.nextRetryAt <= nowMs;
  }

  #recordFailure(symbol, error) {
    const previous = this.failureCache.get(symbol);
    const attempts = Math.min((previous?.attempts ?? 0) + 1, 8);
    const backoffMs = Math.min(this.retryMaxDelayMs, this.retryBaseDelayMs * 2 ** (attempts - 1));

    this.failureCache.set(symbol, {
      attempts,
      nextRetryAt: this.now() + backoffMs,
      message: error instanceof Error ? error.message : "request failed"
    });
  }

  async #loadQuote(symbol) {
    if (this.inFlight.has(symbol)) {
      return this.inFlight.get(symbol);
    }

    const promise = this.#enqueue(async () => {
      try {
        const quote = await fetchSymbolQuote(symbol, {
          requestChartImpl: this.requestChartImpl
        });

        this.quoteCache.set(symbol, {
          quote,
          fetchedAt: this.now()
        });
        this.failureCache.delete(symbol);
        return quote;
      } catch (error) {
        this.#recordFailure(symbol, error);
        throw error;
      }
    }).finally(() => {
      this.inFlight.delete(symbol);
    });

    this.inFlight.set(symbol, promise);
    return promise;
  }

  #enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.#drainQueue();
    });
  }

  #drainQueue() {
    if (this.activeRequests >= this.maxParallelRequests || this.queue.length === 0) {
      return;
    }

    const waitMs = Math.max(0, this.nextLaunchAt - this.now());

    if (waitMs > 0) {
      if (this.queueTimer === null) {
        this.queueTimer = setTimeout(() => {
          this.queueTimer = null;
          this.#drainQueue();
        }, waitMs);
      }
      return;
    }

    while (this.activeRequests < this.maxParallelRequests && this.queue.length > 0) {
      const job = this.queue.shift();
      this.activeRequests += 1;
      this.nextLaunchAt = this.now() + this.symbolDelayMs;

      Promise.resolve()
        .then(job.task)
        .then(job.resolve, job.reject)
        .finally(() => {
          this.activeRequests -= 1;
          this.#drainQueue();
        });

      if (this.symbolDelayMs > 0) {
        this.#drainQueue();
        return;
      }
    }
  }
}

const defaultQuoteService = new SharedQuoteService();

export async function fetchIndexQuote(symbol = DEFAULT_INDEX_SYMBOL, options = {}) {
  return defaultQuoteService.fetchIndexQuote(symbol, options);
}

export async function fetchQuotes(symbols, options = {}) {
  return defaultQuoteService.fetchQuotes(symbols, options);
}
