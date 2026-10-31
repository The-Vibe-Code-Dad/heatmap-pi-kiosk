import { buildNasdaq100Layout } from "../data/markets.js";

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function safeNumber(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeState(rawState) {
  const state = `${rawState ?? ""}`.toUpperCase();

  if (state.includes("REGULAR")) {
    return "REGULAR";
  }

  if (state.includes("PRE")) {
    return "PRE";
  }

  if (state.includes("POST")) {
    return "POST";
  }

  return "CLOSED";
}

function labelForState(state) {
  if (state === "REGULAR") {
    return "Regular session";
  }

  if (state === "PRE") {
    return "Pre-market";
  }

  if (state === "POST") {
    return "After hours";
  }

  return "Closed";
}

function pickQuoteView(quote) {
  const normalizedState = normalizeState(quote?.marketState);

  if (normalizedState === "PRE") {
    return {
      state: normalizedState,
      price: safeNumber(quote?.preMarketPrice, safeNumber(quote?.regularMarketPrice, null)),
      change: safeNumber(quote?.preMarketChange, safeNumber(quote?.regularMarketChange, 0)),
      changePercent: safeNumber(
        quote?.preMarketChangePercent,
        safeNumber(quote?.regularMarketChangePercent, 0)
      ),
      timestamp: safeNumber(quote?.preMarketTime, safeNumber(quote?.regularMarketTime, null))
    };
  }

  if (normalizedState === "POST") {
    return {
      state: normalizedState,
      price: safeNumber(quote?.postMarketPrice, safeNumber(quote?.regularMarketPrice, null)),
      change: safeNumber(quote?.postMarketChange, safeNumber(quote?.regularMarketChange, 0)),
      changePercent: safeNumber(
        quote?.postMarketChangePercent,
        safeNumber(quote?.regularMarketChangePercent, 0)
      ),
      timestamp: safeNumber(quote?.postMarketTime, safeNumber(quote?.regularMarketTime, null))
    };
  }

  return {
    state: normalizedState,
    price: safeNumber(quote?.regularMarketPrice, null),
    change: safeNumber(quote?.regularMarketChange, 0),
    changePercent: safeNumber(quote?.regularMarketChangePercent, 0),
    timestamp: safeNumber(quote?.regularMarketTime, null)
  };
}

function buildCompanyRecord(company, quote) {
  const quoteView = pickQuoteView(quote);
  const marketCap = safeNumber(quote?.marketCap, 1);

  return {
    ...company,
    currency: quote?.currency ?? "USD",
    marketCap,
    price: quoteView.price,
    change: quoteView.change,
    changePercent: quoteView.changePercent,
    previousClose: safeNumber(quote?.regularMarketPreviousClose, null),
    state: quoteView.state,
    stateLabel: labelForState(quoteView.state),
    timestamp: quoteView.timestamp,
    hasLiveData: quoteView.price !== null
  };
}

function normalizeMarket(market, companies, fallbackMarket = null) {
  if (market) {
    return market;
  }

  if (fallbackMarket) {
    return fallbackMarket;
  }

  return {
    id: "custom",
    title: "HEAT MAP",
    universeEffectiveDate: null,
    universeSourceNote: null,
    index: {
      symbol: "NDX",
      name: "Heat Map Index"
    },
    layout: {
      rowItemCounts: [companies.length],
      columnCount: companies.length,
      split: null
    }
  };
}

function layoutForMarket(market, companyCount) {
  if (market.id === "nasdaq100") {
    return buildNasdaq100Layout(companyCount);
  }

  return market.layout;
}

function buildMarketRecord(market, companyCount) {
  const layout = layoutForMarket(market, companyCount);

  return {
    id: market.id,
    title: market.title,
    index: {
      symbol: market.index.symbol,
      name: market.index.name
    },
    layout: {
      rowItemCounts: [...layout.rowItemCounts],
      columnCount: layout.columnCount,
      split: layout.split ? { ...layout.split } : null,
      splits: layout.splits?.map((split) => ({ ...split })) ?? []
    }
  };
}

function buildIndexRecord(quote, market, fallback = null) {
  if (!quote) {
    return (
      fallback ?? {
        symbol: market.index.symbol,
        name: market.index.name,
        price: null,
        change: 0,
        changePercent: 0,
        state: "CLOSED",
        stateLabel: "Awaiting feed",
        timestamp: null,
        hasLiveData: false
      }
    );
  }

  const quoteView = pickQuoteView(quote);

  return {
    symbol: market.index.symbol,
    name: market.index.name,
    price: quoteView.price,
    change: quoteView.change,
    changePercent: quoteView.changePercent,
    state: quoteView.state,
    stateLabel: labelForState(quoteView.state),
    timestamp: quoteView.timestamp,
    hasLiveData: quoteView.price !== null
  };
}

function buildSectorRecords(companies) {
  const sectors = new Map();

  for (const company of companies) {
    const bucket = sectors.get(company.sector) ?? [];
    bucket.push(company);
    sectors.set(company.sector, bucket);
  }

  return [...sectors.entries()]
    .map(([label, members]) => {
      const marketCap = sum(members.map((member) => member.marketCap));
      const weightedChangePercent =
        marketCap > 0
          ? sum(members.map((member) => member.changePercent * member.marketCap)) / marketCap
          : 0;

      return {
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label,
        marketCap,
        changePercent: weightedChangePercent,
        companies: members.sort((left, right) => right.marketCap - left.marketCap)
      };
    })
    .sort((left, right) => right.marketCap - left.marketCap);
}

function detectSession(companies) {
  const states = new Set(companies.filter((company) => company.hasLiveData).map((company) => company.state));

  if (states.has("REGULAR")) {
    return "Regular session";
  }

  if (states.has("PRE")) {
    return "Pre-market";
  }

  if (states.has("POST")) {
    return "After hours";
  }

  return "Closed";
}

function buildSummary(companies, sectors) {
  const companiesWithData = companies.filter((company) => company.hasLiveData);
  const totalMarketCap = sum(companies.map((company) => company.marketCap));
  const biggestMover =
    companiesWithData
      .slice()
      .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))[0] ?? null;
  const leaders = companiesWithData
    .slice()
    .sort((left, right) => right.changePercent - left.changePercent)
    .slice(0, 5)
    .map((company) => ({
      symbol: company.symbol,
      name: company.name,
      changePercent: company.changePercent
    }));
  const laggards = companiesWithData
    .slice()
    .sort((left, right) => left.changePercent - right.changePercent)
    .slice(0, 5)
    .map((company) => ({
      symbol: company.symbol,
      name: company.name,
      changePercent: company.changePercent
    }));

  return {
    advancers: companiesWithData.filter((company) => company.changePercent > 0.05).length,
    decliners: companiesWithData.filter((company) => company.changePercent < -0.05).length,
    unchanged: companiesWithData.filter((company) => Math.abs(company.changePercent) <= 0.05).length,
    liveCompanyCount: companiesWithData.length,
    totalCompanies: companies.length,
    sectorCount: sectors.length,
    totalMarketCap,
    biggestMover:
      biggestMover === null
        ? null
        : {
            symbol: biggestMover.symbol,
            name: biggestMover.name,
            changePercent: biggestMover.changePercent
          },
    leaders,
    laggards
  };
}

function latestTimestamp(companies) {
  const timestamps = companies
    .map((company) => company.timestamp)
    .filter((timestamp) => Number.isFinite(timestamp));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps) * 1000).toISOString();
}

export function buildPlaceholderSnapshot(companies, { refreshMs, errors = [], market: rawMarket } = {}) {
  const market = normalizeMarket(rawMarket, companies);
  const placeholderCompanies = companies.map((company) => ({
    ...company,
    currency: "USD",
    marketCap: 1,
    price: null,
    change: 0,
    changePercent: 0,
    previousClose: null,
    state: "CLOSED",
    stateLabel: "Awaiting feed",
    timestamp: null,
    hasLiveData: false
  }));
  const sectors = buildSectorRecords(placeholderCompanies);

  return {
    fetchedAt: null,
    latestMarketTimestamp: null,
    stale: true,
    status: "warming",
    marketSession: "Awaiting feed",
    refreshMs,
    market: buildMarketRecord(market, companies.length),
    universeEffectiveDate: market.universeEffectiveDate,
    universeSourceNote: market.universeSourceNote,
    index: buildIndexRecord(null, market),
    errors,
    summary: buildSummary(placeholderCompanies, sectors),
    sectors
  };
}

export function buildHeatmapSnapshot(companies, quotes, indexQuoteOrOptions, options = {}) {
  const hasOptionsShape =
    indexQuoteOrOptions &&
    typeof indexQuoteOrOptions === "object" &&
    ("refreshMs" in indexQuoteOrOptions || "previousSnapshot" in indexQuoteOrOptions) &&
    !("symbol" in indexQuoteOrOptions);
  const indexQuote = hasOptionsShape ? null : indexQuoteOrOptions;
  const { refreshMs, previousSnapshot, market: rawMarket } = hasOptionsShape
    ? indexQuoteOrOptions
    : options;
  const market = normalizeMarket(rawMarket, companies, previousSnapshot?.market);
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const mergedCompanies = companies.map((company) => buildCompanyRecord(company, bySymbol.get(company.symbol)));
  const sectors = buildSectorRecords(mergedCompanies);

  return {
    fetchedAt: new Date().toISOString(),
    latestMarketTimestamp: latestTimestamp(mergedCompanies),
    stale: false,
    status: "live",
    marketSession: detectSession(mergedCompanies),
    refreshMs,
    market: buildMarketRecord(market, companies.length),
    universeEffectiveDate: market.universeEffectiveDate,
    universeSourceNote: market.universeSourceNote,
    index: buildIndexRecord(indexQuote, market, previousSnapshot?.index),
    errors: [],
    summary: buildSummary(mergedCompanies, sectors),
    sectors
  };
}

export function markSnapshotStale(previousSnapshot, error) {
  const message = error instanceof Error ? error.message : "Quote refresh failed.";

  return {
    ...previousSnapshot,
    stale: true,
    status: previousSnapshot.summary.liveCompanyCount > 0 ? "stale" : "degraded",
    errors: [message]
  };
}
