export type Period = "5d" | "1mo" | "3mo" | "6mo" | "1y" | "3y" | "5y";

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20?: number;
  rsi14?: number;
}

export interface Signal {
  action: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  reason: string;
  stopLoss: number;
  stopLossType: "strict";
  stopLossPercent: number;
  targetPrice?: number;
}

export interface StockMeta {
  symbol: string;
  period: Period;
  currency: string;
  timezone: string;
  lastUpdated: string;
  dataPoints: number;
  cached: boolean;
}

export interface StockResponse {
  meta: StockMeta;
  data: PricePoint[];
  signal: Signal;
}

export const PERIODS: { value: Period; label: string }[] = [
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "3y", label: "3Y" },
  { value: "5y", label: "5Y" },
];
