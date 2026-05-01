import { PricePoint, Period } from "./types";

const VALID_PERIODS: Record<Period, { range: string; interval: string }> = {
  "5d": { range: "5d", interval: "1d" },
  "1mo": { range: "1mo", interval: "1d" },
  "3mo": { range: "3mo", interval: "1d" },
  "6mo": { range: "6mo", interval: "1d" },
  "1y": { range: "1y", interval: "1wk" },
  "3y": { range: "3y", interval: "1mo" },
  "5y": { range: "5y", interval: "1mo" },
};

interface YahooQuote {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchYahooHistory(
  symbol: string,
  period: Period
): Promise<PricePoint[]> {
  const yahooSymbol = `${symbol.toUpperCase()}.NS`;
  const config = VALID_PERIODS[period];

  // Use Yahoo Finance query1 API directly
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${config.range}&interval=${config.interval}&includeAdjustedClose=true`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Yahoo API returned ${response.status}`);
    }

    const json = await response.json();
    const result = json.chart?.result?.[0];

    if (!result || !result.timestamp || result.timestamp.length === 0) {
      throw new Error("No data returned from Yahoo Finance");
    }

    const timestamps: number[] = result.timestamp;
    const quotes = result.indicators?.quote?.[0] ?? {};
    const { open = [], high = [], low = [], close = [], volume = [] } = quotes;

    const data: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = close[i];
      if (c === null || c === undefined || isNaN(c)) continue;

      data.push({
        date: new Date(timestamps[i] * 1000).toISOString().split("T")[0],
        open: open[i] ?? c,
        high: high[i] ?? c,
        low: low[i] ?? c,
        close: c,
        volume: volume[i] ?? 0,
      });
    }

    return data;
  } catch (error) {
    console.error("Yahoo Finance fetch failed:", error);
    throw error;
  }
}
