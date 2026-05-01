import { NextRequest, NextResponse } from "next/server";
import { Period, StockResponse } from "../../../../lib/types";
import { fetchYahooHistory } from "../../../../lib/yahoo-client";
import { generateSignal } from "../../../../lib/signal-engine";
import { getCache, setCache } from "../../../../lib/cache-client";

const VALID_PERIODS: Period[] = ["5d", "1mo", "3mo", "6mo", "1y", "3y", "5y"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") as Period;

    // Validate period
    if (!period || !VALID_PERIODS.includes(period)) {
      return NextResponse.json(
        {
          error: "INVALID_PERIOD",
          message: `Period must be one of: ${VALID_PERIODS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `stock:${upperSymbol}:${period}`;

    // Try cache first
    const cached = await getCache<StockResponse>(cacheKey);
    if (cached) {
      cached.meta.cached = true;
      return NextResponse.json(cached);
    }

    // Fetch from Yahoo Finance
    const data = await fetchYahooHistory(upperSymbol, period);

    if (data.length === 0) {
      return NextResponse.json(
        {
          error: "SYMBOL_NOT_FOUND",
          message: `${upperSymbol} is not a valid NSE symbol or has no trading history`,
        },
        { status: 404 }
      );
    }

    // Generate signal
    const signal = generateSignal(data);

    const response: StockResponse = {
      meta: {
        symbol: `${upperSymbol}.NS`,
        period,
        currency: "INR",
        timezone: "Asia/Kolkata",
        lastUpdated: new Date().toISOString(),
        dataPoints: data.length,
        cached: false,
      },
      data,
      signal,
    };

    // Cache for 15 minutes
    await setCache(cacheKey, response, 900);

    return NextResponse.json(response);
  } catch (error) {
    console.error("API error:", error);

    if (error instanceof Error && error.message.includes("429")) {
      return NextResponse.json(
        {
          error: "RATE_LIMITED",
          message: "Data source temporarily unavailable, try again in 60s",
          retryAfter: 60,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "DATA_UNAVAILABLE",
        message: "Unable to fetch market data at this time",
      },
      { status: 503 }
    );
  }
}
