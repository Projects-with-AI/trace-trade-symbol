"use client";

import { Signal } from "../lib/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SignalCardProps {
  signal: Signal;
}

export default function SignalCard({ signal }: SignalCardProps) {
  const { action, confidence, reason } = signal;

  const config = {
    BUY: {
      icon: TrendingUp,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      label: "BUY",
    },
    SELL: {
      icon: TrendingDown,
      color: "text-rose-700",
      bg: "bg-rose-50",
      border: "border-rose-200",
      label: "SELL",
    },
    NEUTRAL: {
      icon: Minus,
      color: "text-slate-700",
      bg: "bg-slate-50",
      border: "border-slate-200",
      label: "NEUTRAL",
    },
  };

  const { icon: Icon, color, bg, border, label } = config[action];

  return (
    <div className={`p-4 rounded-lg border ${border} ${bg}`}>
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className={`text-lg font-bold ${color}`}>{label}</span>
        <span className="ml-auto text-sm font-medium text-slate-600">
          Confidence: {confidence}%
        </span>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{reason}</p>
    </div>
  );
}
