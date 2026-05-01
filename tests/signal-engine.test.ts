import { generateSignal } from "../app/lib/signal-engine";
import { PricePoint } from "../app/lib/types";

function createData(points: Partial<PricePoint>[]): PricePoint[] {
  return points.map((p, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    open: p.open ?? 100,
    high: p.high ?? 102,
    low: p.low ?? 98,
    close: p.close ?? 100,
    volume: p.volume ?? 1000000,
  }));
}

describe("generateSignal", () => {
  // ── Edge cases ──
  test("returns NEUTRAL when fewer than 20 data points", () => {
    const data = createData(Array(5).fill({ close: 100 }));
    const signal = generateSignal(data);
    expect(signal.action).toBe("NEUTRAL");
    expect(signal.confidence).toBe(50);
    expect(signal.reason).toContain("Insufficient");
  });

  test("handles empty data array gracefully", () => {
    const signal = generateSignal([]);
    expect(signal.action).toBe("NEUTRAL");
    expect(signal.stopLoss).toBe(0);
  });

  // ── BUY signal ──
  test("generates BUY when price > SMA20 and RSI < 70", () => {
    // Volatile uptrend: flat base, dip, then strong rally — keeps RSI moderate
    const closes = [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
      100, 80, 75, 80, 85, 90, 100, 110, 120, 130,
    ];
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.action).toBe("BUY");
    expect(signal.stopLossType).toBe("strict");
    expect(signal.stopLoss).toBeLessThan(data[data.length - 1].close);
    expect(signal.confidence).toBeGreaterThan(50);
    expect(signal.confidence).toBeLessThanOrEqual(95);
  });

  test("BUY stop-loss is below last 5-day low", () => {
    // Volatile uptrend to keep RSI moderate
    const closes = [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
      100, 80, 75, 80, 85, 90, 100, 110, 120, 130,
    ];
    const data = createData(closes.map((c) => ({ close: c, low: c - 2, high: c + 2 })));
    const signal = generateSignal(data);
    expect(signal.action).toBe("BUY");
    const last5Low = Math.min(...data.slice(-5).map((d) => d.low));
    expect(signal.stopLoss).toBeLessThanOrEqual(last5Low * 0.985);
  });

  test("does NOT buy when RSI > 70 (overbought)", () => {
    // Strong uptrend that pushes RSI high
    const closes = Array(20).fill(null).map((_, i) => 100 + i * 5);
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.action).not.toBe("BUY");
  });

  test("does NOT buy when trend < 0.5% above SMA (too weak)", () => {
    // Price barely above SMA — should be NEUTRAL
    const closes = Array(19).fill(100).concat([100.3]);
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.action).toBe("NEUTRAL");
  });

  // ── SELL signal ──
  test("generates SELL when price < SMA20 and RSI > 30", () => {
    // Volatile downtrend: flat base, rally, then strong decline — keeps RSI moderate
    const closes = [
      130, 130, 130, 130, 130, 130, 130, 130, 130, 130,
      130, 150, 145, 150, 145, 140, 135, 125, 115, 100,
    ];
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.action).toBe("SELL");
    expect(signal.stopLoss).toBeGreaterThan(data[data.length - 1].close);
    expect(signal.confidence).toBeGreaterThan(50);
  });

  test("SELL stop-loss is above last 5-day high", () => {
    // Volatile downtrend to keep RSI moderate
    const closes = [
      130, 130, 130, 130, 130, 130, 130, 130, 130, 130,
      130, 150, 145, 150, 145, 140, 135, 125, 115, 100,
    ];
    const data = createData(closes.map((c) => ({ close: c, low: c - 2, high: c + 2 })));
    const signal = generateSignal(data);
    expect(signal.action).toBe("SELL");
    const last5High = Math.max(...data.slice(-5).map((d) => d.high));
    expect(signal.stopLoss).toBeGreaterThanOrEqual(last5High * 1.015);
  });

  test("does NOT sell when RSI < 30 (oversold)", () => {
    // Strong downtrend that pushes RSI low
    const closes = Array(20).fill(null).map((_, i) => 100 - i * 5);
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.action).not.toBe("SELL");
  });

  // ── NEUTRAL signal ──
  test("returns NEUTRAL when price near SMA20 and RSI mid-range", () => {
    const closes = Array(20).fill(100);
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.action).toBe("NEUTRAL");
  });

  // ── Stop-loss validation ──
  test("strict stop-loss never changes value after calculation", () => {
    const data = createData(
      Array(19).fill(null).map((_, i) => ({ close: 100 + i })).concat([{ close: 130 }])
    );
    const s1 = generateSignal(data);
    const s2 = generateSignal(data);
    expect(s1.stopLoss).toBe(s2.stopLoss);
  });

  test("stop-loss percentage is reasonable (not negative)", () => {
    const data = createData(
      Array(20).fill(null).map((_, i) => ({ close: 100 + i * 2 }))
    );
    const signal = generateSignal(data);
    expect(signal.stopLossPercent).toBeGreaterThan(0);
    expect(signal.stopLossPercent).toBeLessThan(10);
  });

  // ── Confidence bounds ──
  test("confidence never exceeds 95", () => {
    // Strong volatile trend to push confidence high but RSI stays < 70
    const closes = [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
      100, 70, 65, 70, 75, 80, 90, 110, 130, 160,
    ];
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.confidence).toBeLessThanOrEqual(95);
  });

  test("confidence never below 50 for valid signals", () => {
    // Weak but valid trend (>0.5% above SMA) with moderate RSI
    const closes = [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
      100, 95, 100, 98, 102, 100, 104, 102, 106, 108,
    ];
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    if (signal.action !== "NEUTRAL") {
      expect(signal.confidence).toBeGreaterThanOrEqual(50);
    }
  });

  // ── Target price validation ──
  test("BUY target is above current price", () => {
    const data = createData(
      Array(19).fill(null).map((_, i) => ({ close: 100 + i })).concat([{ close: 120 }])
    );
    const signal = generateSignal(data);
    if (signal.action === "BUY") {
      expect(signal.targetPrice).toBeDefined();
      expect(signal.targetPrice!).toBeGreaterThan(data[data.length - 1].close);
    }
  });

  test("SELL target is below current price", () => {
    const data = createData(
      Array(19).fill(null).map((_, i) => ({ close: 120 - i })).concat([{ close: 100 }])
    );
    const signal = generateSignal(data);
    if (signal.action === "SELL") {
      expect(signal.targetPrice).toBeDefined();
      expect(signal.targetPrice!).toBeLessThan(data[data.length - 1].close);
    }
  });
});
