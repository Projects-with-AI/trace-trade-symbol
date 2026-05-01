/**
 * @jest-environment node
 */

import { GET } from "../app/api/stocks/[symbol]/history/route";

// Mock the modules
jest.mock("../app/lib/cache-client");
jest.mock("../app/lib/yahoo-client");
jest.mock("../app/lib/signal-engine");

import { getCache, setCache } from "../app/lib/cache-client";
import { fetchYahooHistory } from "../app/lib/yahoo-client";
import { generateSignal } from "../app/lib/signal-engine";

const mockedGetCache = getCache as jest.MockedFunction<typeof getCache>;
const mockedSetCache = setCache as jest.MockedFunction<typeof setCache>;
const mockedFetchYahoo = fetchYahooHistory as jest.MockedFunction<typeof fetchYahooHistory>;
const mockedGenerateSignal = generateSignal as jest.MockedFunction<typeof generateSignal>;

describe("/api/stocks/[symbol]/history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockRequest(symbol: string, period?: string) {
    const url = new URL(
      `http://localhost/api/stocks/${symbol}/history${period ? `?period=${period}` : ""}`
    );
    return new Request(url) as any;
  }

  // ── 400 Bad Request ──
  test("returns 400 for missing period", async () => {
    const res = await GET(mockRequest("RELIANCE"), { params: Promise.resolve({ symbol: "RELIANCE" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_PERIOD");
  });

  test("returns 400 for invalid period", async () => {
    const res = await GET(mockRequest("RELIANCE", "10y"), { params: Promise.resolve({ symbol: "RELIANCE" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("5d, 1mo");
  });

  test("returns 400 for empty period", async () => {
    const res = await GET(mockRequest("RELIANCE", ""), { params: Promise.resolve({ symbol: "RELIANCE" }) });
    expect(res.status).toBe(400);
  });

  // ── 200 OK — cache hit ──
  test("returns cached data on cache hit", async () => {
    const cached = {
      meta: { symbol: "RELIANCE.NS", period: "1y", cached: false },
      data: [],
      signal: { action: "BUY", confidence: 70, reason: "test", stopLoss: 2800, stopLossType: "strict", stopLossPercent: 1.5 },
    };
    mockedGetCache.mockResolvedValue(cached as any);

    const res = await GET(mockRequest("RELIANCE", "1y"), { params: Promise.resolve({ symbol: "RELIANCE" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.cached).toBe(true);
    expect(mockedFetchYahoo).not.toHaveBeenCalled();
  });

  // ── 200 OK — live fetch ──
  test("fetches live data on cache miss", async () => {
    mockedGetCache.mockResolvedValue(null);
    mockedFetchYahoo.mockResolvedValue([
      { date: "2026-01-01", open: 100, high: 102, low: 98, close: 100, volume: 1000 },
    ]);
    mockedGenerateSignal.mockReturnValue({
      action: "NEUTRAL",
      confidence: 50,
      reason: "test",
      stopLoss: 99,
      stopLossType: "strict",
      stopLossPercent: 1,
    });

    const res = await GET(mockRequest("TCS", "1mo"), { params: Promise.resolve({ symbol: "TCS" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.symbol).toBe("TCS.NS");
    expect(body.meta.cached).toBe(false);
    expect(mockedFetchYahoo).toHaveBeenCalledWith("TCS", "1mo");
    expect(mockedSetCache).toHaveBeenCalled();
  });

  // ── 404 Not Found ──
  test("returns 404 when no data returned", async () => {
    mockedGetCache.mockResolvedValue(null);
    mockedFetchYahoo.mockResolvedValue([]);

    const res = await GET(mockRequest("INVALID", "1y"), { params: Promise.resolve({ symbol: "INVALID" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("SYMBOL_NOT_FOUND");
  });

  // ── 503 / 429 error propagation ──
  test("returns 429 when Yahoo rate limits", async () => {
    mockedGetCache.mockResolvedValue(null);
    mockedFetchYahoo.mockRejectedValue(new Error("429 Too Many Requests"));

    const res = await GET(mockRequest("RELIANCE", "1y"), { params: Promise.resolve({ symbol: "RELIANCE" }) });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.retryAfter).toBe(60);
  });

  test("returns 503 on general fetch failure", async () => {
    mockedGetCache.mockResolvedValue(null);
    mockedFetchYahoo.mockRejectedValue(new Error("network error"));

    const res = await GET(mockRequest("RELIANCE", "1y"), { params: Promise.resolve({ symbol: "RELIANCE" }) });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("DATA_UNAVAILABLE");
  });

  // ── Symbol normalization ──
  test("normalizes symbol to uppercase", async () => {
    mockedGetCache.mockResolvedValue(null);
    mockedFetchYahoo.mockResolvedValue([
      { date: "2026-01-01", open: 100, high: 102, low: 98, close: 100, volume: 1000 },
    ]);
    mockedGenerateSignal.mockReturnValue({
      action: "NEUTRAL",
      confidence: 50,
      reason: "test",
      stopLoss: 99,
      stopLossType: "strict",
      stopLossPercent: 1,
    });

    await GET(mockRequest("reliance", "5d"), { params: Promise.resolve({ symbol: "reliance" }) });
    expect(mockedFetchYahoo).toHaveBeenCalledWith("RELIANCE", "5d");
  });

  // ── Cache TTL verification ──
  test("sets cache with 15-minute TTL", async () => {
    mockedGetCache.mockResolvedValue(null);
    mockedFetchYahoo.mockResolvedValue([
      { date: "2026-01-01", open: 100, high: 102, low: 98, close: 100, volume: 1000 },
    ]);
    mockedGenerateSignal.mockReturnValue({
      action: "NEUTRAL",
      confidence: 50,
      reason: "test",
      stopLoss: 99,
      stopLossType: "strict",
      stopLossPercent: 1,
    });

    await GET(mockRequest("INFY", "1mo"), { params: Promise.resolve({ symbol: "INFY" }) });
    expect(mockedSetCache).toHaveBeenCalledWith(
      expect.stringContaining("stock:INFY:1mo"),
      expect.any(Object),
      900 // 15 minutes
    );
  });
});
