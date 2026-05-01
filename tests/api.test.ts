/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "../app/api/stocks/[symbol]/history/route";

// Yahoo Finance API response shape for mocking
type YahooResponse = {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> };
    }> | null;
  };
};

function makeYahooResponse(
  count: number,
  basePrice: number,
  options?: { allNullClose?: boolean }
): YahooResponse {
  const now = Math.floor(Date.now() / 1000);
  const timestamps = Array.from({ length: count }, (_, i) => now - (count - i) * 86400);

  if (options?.allNullClose) {
    return {
      chart: {
        result: [{
          timestamp: timestamps,
          indicators: { quote: [{ open: Array(count).fill(null), high: Array(count).fill(null), low: Array(count).fill(null), close: Array(count).fill(null), volume: Array(count).fill(0) }] },
        }],
      },
    };
  }

  const close = Array.from({ length: count }, (_, i) => basePrice + i * 2);
  return {
    chart: {
      result: [{
        timestamp: timestamps,
        indicators: { quote: [{ open: close.map((c) => c - 1), high: close.map((c) => c + 2), low: close.map((c) => c - 2), close, volume: Array(count).fill(1000000) }] },
      }],
    },
  };
}

describe("/api/stocks/[symbol]/history", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => {
      throw new Error("Unexpected fetch — mock not set for this test");
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockRequest(symbol: string, period?: string): NextRequest {
    const url = new URL(
      `http://localhost/api/stocks/${symbol}/history${period ? `?period=${period}` : ""}`
    );
    return new NextRequest(url);
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
    expect(body.message).toContain("5d");
  });

  test("returns 400 for empty period query param", async () => {
    const res = await GET(mockRequest("RELIANCE", ""), { params: Promise.resolve({ symbol: "RELIANCE" }) });
    expect(res.status).toBe(400);
  });

  // ── 200 OK — live fetch (cache miss, no Redis env) ──
  test("returns 200 with Yahoo data on cache miss", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeYahooResponse(25, 100),
    } as Response);

    const res = await GET(mockRequest("TCS", "1mo"), { params: Promise.resolve({ symbol: "TCS" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.symbol).toBe("TCS.NS");
    expect(body.meta.period).toBe("1mo");
    expect(body.meta.dataPoints).toBe(25);
    expect(body.meta.cached).toBe(false);
    expect(body.data.length).toBe(25);
    expect(body.signal.action).toMatch(/BUY|SELL|NEUTRAL/);
    expect(body.signal.confidence).toBeGreaterThanOrEqual(50);
    expect(body.signal.stopLossType).toBe("strict");

    // Verify Yahoo URL used uppercase symbol
    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain("TCS.NS");
  });

  // ── 404 Not Found — all close values null ──
  test("returns 404 when Yahoo returns all null closes", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeYahooResponse(5, 100, { allNullClose: true }),
    } as Response);

    const res = await GET(mockRequest("INVALID", "5d"), { params: Promise.resolve({ symbol: "INVALID" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("SYMBOL_NOT_FOUND");
  });

  // ── 429 Rate Limited ──
  test("returns 429 when Yahoo responds with 429", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    } as Response);

    const res = await GET(mockRequest("RELIANCE", "1y"), { params: Promise.resolve({ symbol: "RELIANCE" }) });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.retryAfter).toBe(60);
  });

  // ── 503 General error ──
  test("returns 503 when fetch throws network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));

    const res = await GET(mockRequest("RELIANCE", "1y"), { params: Promise.resolve({ symbol: "RELIANCE" }) });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("DATA_UNAVAILABLE");
    expect(body.message).toContain("Unable to fetch");
  });

  // ── Symbol normalization ──
  test("normalizes symbol to uppercase in Yahoo URL", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeYahooResponse(25, 100),
    } as Response);

    await GET(mockRequest("reliance", "5d"), { params: Promise.resolve({ symbol: "reliance" }) });
    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain("RELIANCE.NS");
    expect(callUrl).not.toContain("reliance.NS");
  });

  // ── Period mapping ──
  test("maps 1y period to correct Yahoo range/interval", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeYahooResponse(52, 100),
    } as Response);

    await GET(mockRequest("INFY", "1y"), { params: Promise.resolve({ symbol: "INFY" }) });
    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain("range=1y");
    expect(callUrl).toContain("interval=1wk");
  });
});
