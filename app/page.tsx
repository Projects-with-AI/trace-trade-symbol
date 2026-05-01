"use client";

import { useState } from "react";
import { Period, StockResponse } from "./lib/types";
import SymbolSearch from "./components/SymbolSearch";
import PeriodSelector from "./components/PeriodSelector";
import PriceChart from "./components/PriceChart";
import SignalCard from "./components/SignalCard";
import StopLossCard from "./components/StopLossCard";
import { Loader2, AlertTriangle } from "lucide-react";

export default function Home() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [period, setPeriod] = useState<Period>("1y");
  const [data, setData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/${symbol}/history?period=${period}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch data");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Trace Trade</h1>
              <p className="text-xs text-slate-500">NSE Stock Tracker with Signals</p>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <SymbolSearch value={symbol} onChange={setSymbol} />
              <PeriodSelector value={period} onChange={setPeriod} />
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Track"
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Disclaimer */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            This tool provides algorithmic signals based on technical indicators (SMA + RSI) for educational purposes only.
            It is <strong>not financial advice</strong>. Always consult a SEBI-registered investment advisor before trading.
            Past performance does not guarantee future results.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
            {error}
          </div>
        )}

        {!data && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <p className="text-lg font-medium">Search for an NSE symbol to begin</p>
            <p className="text-sm mt-1">e.g. RELIANCE, TCS, INFY, HDFCBANK</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Symbol header */}
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold text-slate-900">{data.meta.symbol}</h2>
              <span className="text-sm text-slate-500">
                {data.meta.dataPoints} data points · {data.meta.cached ? "Cached" : "Live"}
              </span>
            </div>

            {/* Signal + Stop Loss row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SignalCard signal={data.signal} />
              <StopLossCard signal={data.signal} />
            </div>

            {/* Chart */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Price History</h3>
              <PriceChart data={data.data} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(() => {
                const prices = data.data.map((d) => d.close);
                const latest = prices[prices.length - 1];
                const earliest = prices[0];
                const high = Math.max(...data.data.map((d) => d.high));
                const low = Math.min(...data.data.map((d) => d.low));
                const change = ((latest - earliest) / earliest) * 100;

                return [
                  { label: "Current", value: `₹${latest.toLocaleString()}`, color: "" },
                  { label: "Period Change", value: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`, color: change >= 0 ? "text-emerald-600" : "text-rose-600" },
                  { label: "Period High", value: `₹${high.toLocaleString()}`, color: "" },
                  { label: "Period Low", value: `₹${low.toLocaleString()}`, color: "" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">{stat.label}</div>
                    <div className={`text-lg font-semibold ${stat.color}`}>{stat.value}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
