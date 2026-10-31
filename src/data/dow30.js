export const UNIVERSE_EFFECTIVE_DATE = "2026-03-25";
export const UNIVERSE_SOURCE_NOTE = "Basket reflects the Dow Jones Industrial Average components table on Wikipedia, which lists the roster as of 2026-03-25.";

export const DOW_30_COMPANIES = [
  { symbol: "MMM", name: "3M", sector: "Industrials" },
  { symbol: "AXP", name: "American Express", sector: "Financials" },
  { symbol: "AMGN", name: "Amgen", sector: "Health Care" },
  { symbol: "AMZN", name: "Amazon", sector: "Consumer Discretionary" },
  { symbol: "AAPL", name: "Apple", sector: "Information Technology" },
  { symbol: "BA", name: "Boeing", sector: "Industrials" },
  { symbol: "CAT", name: "Caterpillar", sector: "Industrials" },
  { symbol: "CVX", name: "Chevron", sector: "Energy" },
  { symbol: "CSCO", name: "Cisco", sector: "Information Technology" },
  { symbol: "KO", name: "Coca-Cola", sector: "Consumer Staples" },
  { symbol: "DIS", name: "Disney", sector: "Communication Services" },
  { symbol: "GS", name: "Goldman Sachs", sector: "Financials" },
  { symbol: "HD", name: "Home Depot", sector: "Consumer Discretionary" },
  { symbol: "HON", name: "Honeywell", sector: "Industrials" },
  { symbol: "IBM", name: "IBM", sector: "Information Technology" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Health Care" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials" },
  { symbol: "MCD", name: "McDonald's", sector: "Consumer Discretionary" },
  { symbol: "MRK", name: "Merck", sector: "Health Care" },
  { symbol: "MSFT", name: "Microsoft", sector: "Information Technology" },
  { symbol: "NKE", name: "Nike", sector: "Consumer Discretionary" },
  { symbol: "NVDA", name: "Nvidia", sector: "Information Technology" },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples" },
  { symbol: "CRM", name: "Salesforce", sector: "Information Technology" },
  { symbol: "SHW", name: "Sherwin-Williams", sector: "Materials" },
  { symbol: "TRV", name: "Travelers Companies, Inc.", sector: "Financials" },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Health Care" },
  { symbol: "VZ", name: "Verizon", sector: "Communication Services" },
  { symbol: "V", name: "Visa", sector: "Financials" },
  { symbol: "WMT", name: "Walmart", sector: "Consumer Staples" }
];

export const DOW_30_BY_SYMBOL = new Map(
  DOW_30_COMPANIES.map((company) => [company.symbol, company])
);
