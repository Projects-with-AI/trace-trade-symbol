"use client";

import { Signal } from "../lib/types";
import { Shield } from "lucide-react";

interface StopLossCardProps {
  signal: Signal;
}

export default function StopLossCard({ signal }: StopLossCardProps) {
  const { stopLoss, stopLossPercent, targetPrice, action } = signal;

  return (
    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-5 h-5 text-amber-700" />
        <span className="font-bold text-amber-800">Strict Stop Loss</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-amber-600 mb-1">Stop Loss Price</div>
          <div className="text-xl font-bold text-amber-800">
            ₹{stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-amber-600 mb-1">Risk</div>
          <div className="text-xl font-bold text-amber-800">
            {stopLossPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {targetPrice && (
        <div className="mt-3 pt-3 border-t border-amber-200">
          <div className="flex justify-between items-center">
            <span className="text-xs text-amber-600">
              {action === "BUY" ? "Target (3% gain)" : "Target (3% decline)"}
            </span>
            <span className="font-semibold text-amber-800">
              ₹{targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
