"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

interface SymbolSearchProps {
  value: string;
  onChange: (symbol: string) => void;
}

const POPULAR_NSE_SYMBOLS = [
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK",
  "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK", "LT",
  "HINDUNILVR", "AXISBANK", "BAJFINANCE", "ASIANPAINT", "MARUTI",
  "SUNPHARMA", "TATAMOTORS", "TITAN", "ULTRACEMCO", "NESTLEIND",
];

export default function SymbolSearch({ value, onChange }: SymbolSearchProps) {
  const [input, setInput] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = input.length >= 1
    ? POPULAR_NSE_SYMBOLS.filter((s) =>
        s.toLowerCase().startsWith(input.toLowerCase())
      )
    : [];

  function handleSelect(symbol: string) {
    setInput(symbol);
    onChange(symbol);
    setShowSuggestions(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      onChange(input.trim().toUpperCase());
      setShowSuggestions(false);
    }
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search NSE symbol (e.g. RELIANCE)"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
        />
      </form>

      {showSuggestions && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
          {filtered.map((symbol) => (
            <button
              key={symbol}
              onClick={() => handleSelect(symbol)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
            >
              {symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
