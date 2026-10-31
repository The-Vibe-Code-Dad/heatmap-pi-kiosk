import {
  NASDAQ_100_COMPANIES,
  UNIVERSE_EFFECTIVE_DATE as NASDAQ_100_EFFECTIVE_DATE,
  UNIVERSE_SOURCE_NOTE as NASDAQ_100_SOURCE_NOTE
} from "./nasdaq100.js";
import {
  DOW_30_COMPANIES,
  UNIVERSE_EFFECTIVE_DATE as DOW_30_EFFECTIVE_DATE,
  UNIVERSE_SOURCE_NOTE as DOW_30_SOURCE_NOTE
} from "./dow30.js";
import {
  SP_500_COMPANIES,
  UNIVERSE_EFFECTIVE_DATE as SP_500_EFFECTIVE_DATE,
  UNIVERSE_SOURCE_NOTE as SP_500_SOURCE_NOTE
} from "./sp500.js";

const NASDAQ_100_BASE_COUNT = 100;
const NASDAQ_100_COLUMN_COUNT = 20;
const NASDAQ_100_SPLIT_ROW_INDEX = 2;
const NASDAQ_100_SPLIT_SLOT_INDEXES = [9, 10];
const SP_500_ROW_COUNTS = Array.from({ length: 20 }, () => 25);

export const DEFAULT_MARKET_ID = "sp500";

export function buildNasdaq100Layout(companyCount = NASDAQ_100_BASE_COUNT + 1) {
  const extraCompanies = Math.max(0, companyCount - NASDAQ_100_BASE_COUNT);
  const splitSlotIndexes = NASDAQ_100_SPLIT_SLOT_INDEXES.slice(0, extraCompanies);
  const splits = splitSlotIndexes.map((slotIndex) => ({
    rowIndex: NASDAQ_100_SPLIT_ROW_INDEX,
    slotIndex,
    style: "diagonal"
  }));

  return {
    rowItemCounts: [20, 20, 20 + extraCompanies, 20, 20],
    columnCount: NASDAQ_100_COLUMN_COUNT,
    split: splits[0] ?? null,
    splits
  };
}

export const MARKET_DEFINITIONS = [
  {
    id: "nasdaq100",
    title: "NASDAQ 100 HEAT MAP",
    companies: NASDAQ_100_COMPANIES,
    universeEffectiveDate: NASDAQ_100_EFFECTIVE_DATE,
    universeSourceNote: NASDAQ_100_SOURCE_NOTE,
    source: {
      kind: "wikipedia-raw",
      pageTitle: "Nasdaq-100",
      parser: "nasdaq100",
      expectedCounts: [100, 101, 102]
    },
    index: {
      symbol: "NDX",
      quoteSymbol: "^NDX",
      name: "Nasdaq-100"
    },
    layout: buildNasdaq100Layout(NASDAQ_100_COMPANIES.length)
  },
  {
    id: "dow30",
    title: "DOW 30 HEAT MAP",
    companies: DOW_30_COMPANIES,
    universeEffectiveDate: DOW_30_EFFECTIVE_DATE,
    universeSourceNote: DOW_30_SOURCE_NOTE,
    source: {
      kind: "wikipedia-raw",
      pageTitle: "Dow_Jones_Industrial_Average",
      parser: "dow30",
      expectedCount: 30
    },
    index: {
      symbol: "DJI",
      quoteSymbol: "^DJI",
      name: "Dow Jones Industrial Average"
    },
    layout: {
      rowItemCounts: [10, 10, 10],
      columnCount: 10,
      split: null
    }
  },
  {
    id: "sp500",
    title: "S&P 500 HEAT MAP",
    companies: SP_500_COMPANIES,
    universeEffectiveDate: SP_500_EFFECTIVE_DATE,
    universeSourceNote: SP_500_SOURCE_NOTE,
    source: {
      kind: "wikipedia-raw",
      pageTitle: "List_of_S&P_500_companies",
      parser: "sp500",
      expectedCount: 500
    },
    index: {
      symbol: "SPX",
      quoteSymbol: "^GSPC",
      name: "S&P 500"
    },
    layout: {
      rowItemCounts: SP_500_ROW_COUNTS,
      columnCount: 25,
      split: null
    }
  }
];

export const MARKETS_BY_ID = new Map(MARKET_DEFINITIONS.map((market) => [market.id, market]));

export function createMarketDefinitions() {
  return MARKET_DEFINITIONS.map((market) => ({
    ...market,
    companies: market.companies.map((company) => ({ ...company })),
    source: market.source ? { ...market.source } : null,
    index: { ...market.index },
    layout: {
      ...market.layout,
      rowItemCounts: [...market.layout.rowItemCounts],
      split: market.layout.split ? { ...market.layout.split } : null,
      splits: market.layout.splits?.map((split) => ({ ...split })) ?? []
    }
  }));
}

export function getMarketDefinition(marketId) {
  return MARKETS_BY_ID.get(marketId) ?? MARKETS_BY_ID.get(DEFAULT_MARKET_ID);
}
