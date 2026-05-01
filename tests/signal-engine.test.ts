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
    // Rising trend: price starts at 100, ends at 130
    const data = createData(
      Array(19).fill(null).map((_, i) => ({ close: 100 + i * 1 }))
        .concat([{ close: 130 }])
    );
    const signal = generateSignal(data);
    expect(signal.action).toBe("BUY");
    expect(signal.stopLossType).toBe("strict");
    expect(signal.stopLoss).toBeLessThan(data[data.length - 1].close);
    expect(signal.confidence).toBeGreaterThan(50);
    expect(signal.confidence).toBeLessThanOrEqual(95);
  });

  test("BUY stop-loss is below last 5-day low", () => {
    const closes = Array(15).fill(100).concat([102, 104, 103, 105, 110]);
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.action).toBe("BUY");
    const last5Low = Math.min(...closes.slice(-5));
    expect(signal.stopLoss).toBeLessThanOrEqual(last5Low * 0.998);
  });

  test("does NOT buy when RSI > 70 (overbought)", () => {
    // Strong uptrend that pushes RSI high
    const closes = Array(20).fill(null).map((_, i) => 100 + i * 5);
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.action).not.toBe("BUY");
  });

  // ── SELL signal ──
  test("generates SELL when price < SMA20 and RSI > 30", () => {
    // Downtrend: price starts at 130, ends at 100
    const data = createData(
      Array(19).fill(null).map((_, i) => ({ close: 130 - i * 1 }))
        .concat([{ close: 100 }])
    );
    const signal = generateSignal(data);
    expect(signal.action).toBe("SELL");
    expect(signal.stopLoss).toBeGreaterThan(data[data.length - 1].close);
    expect(signal.confidence).toBeGreaterThan(50);
  });

  test("SELL stop-loss is above last 5-day high", () => {
    const closes = Array(15).fill(100).concat([98, 96, 97, 95, 90]);
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.action).toBe("SELL");
    const last5High = Math.max(...closes.slice(-5));
    expect(signal.stopLoss).toBeGreaterThanOrEqual(last5High * 1.002);
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
    // Extreme trend to push confidence high
    const closes = Array(19).fill(100).concat([200]);
    const data = createData(closes.map((c) => ({ close: c })));
    const signal = generateSignal(data);
    expect(signal.confidence).toBeLessThanOrEqual(95);
  });

  test("confidence never below 50 for valid signals", () => {
    const data = createData(
      Array(19).fill(null).map((_, i) => ({ close: 100 + i * 0.1 })).concat([{ close: 102 }])
    );
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
