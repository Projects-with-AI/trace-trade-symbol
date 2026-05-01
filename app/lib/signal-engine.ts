import { PricePoint, Signal } from "./types";

function calculateSMA(data: PricePoint[], period: number): number {
  if (data.length < period) return data[data.length - 1]?.close ?? 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, d) => acc + d.close, 0);
  return sum / period;
}

function calculateRSI(data: PricePoint[], period: number = 14): number {
  if (data.length < period + 1) return 50;
  const changes = [];
  for (let i = data.length - period; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }
  const gains = changes.filter((c) => c > 0);
  const losses = changes.filter((c) => c < 0).map((c) => Math.abs(c));
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / period : 0;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function generateSignal(data: PricePoint[]): Signal {
  if (data.length < 20) {
    const lastClose = data.length > 0 ? data[data.length - 1].close : 0;
    return {
      action: "NEUTRAL",
      confidence: 50,
      reason: "Insufficient historical data for reliable signal.",
      stopLoss: lastClose > 0 ? lastClose * 0.985 : 0,
      stopLossType: "strict",
      stopLossPercent: 1.5,
    };
  }

  const sma20 = calculateSMA(data, 20);
  const rsi14 = calculateRSI(data, 14);
  const currentPrice = data[data.length - 1].close;
  const last5 = data.slice(-5);
  const lastLow = Math.min(...last5.map((d) => d.low));
  const lastHigh = Math.max(...last5.map((d) => d.high));

  // BUY: Price > SMA20 AND RSI < 70 (not overbought)
  if (currentPrice > sma20 && rsi14 < 70) {
    const stopLoss = lastLow * 0.998;
    const confidence = Math.min(
      95,
      Math.round(
        (rsi14 < 50 ? 80 : 65) + (currentPrice / sma20 - 1) * 500
      )
    );
    return {
      action: "BUY",
      confidence,
      reason: `Price (${currentPrice.toFixed(2)}) above 20-day SMA (${sma20.toFixed(2)}), RSI ${rsi14.toFixed(1)}. Near support at ${lastLow.toFixed(2)}.`,
      stopLoss,
      stopLossType: "strict",
      stopLossPercent: ((currentPrice - stopLoss) / currentPrice) * 100,
      targetPrice: currentPrice * 1.03,
    };
  }

  // SELL: Price < SMA20 AND RSI > 30 (not oversold)
  if (currentPrice < sma20 && rsi14 > 30) {
    const stopLoss = lastHigh * 1.002;
    const confidence = Math.min(
      95,
      Math.round(
        (rsi14 > 50 ? 80 : 65) + (1 - currentPrice / sma20) * 500
      )
    );
    return {
      action: "SELL",
      confidence,
      reason: `Price (${currentPrice.toFixed(2)}) below 20-day SMA (${sma20.toFixed(2)}), RSI ${rsi14.toFixed(1)}. Near resistance at ${lastHigh.toFixed(2)}.`,
      stopLoss,
      stopLossType: "strict",
      stopLossPercent: ((stopLoss - currentPrice) / currentPrice) * 100,
      targetPrice: currentPrice * 0.97,
    };
  }

  // NEUTRAL
  return {
    action: "NEUTRAL",
    confidence: 50,
    reason: `No clear trend. Price ${currentPrice.toFixed(2)} vs SMA20 ${sma20.toFixed(2)}, RSI ${rsi14.toFixed(1)}.`,
    stopLoss: currentPrice * 0.985,
    stopLossType: "strict",
    stopLossPercent: 1.5,
  };
}
