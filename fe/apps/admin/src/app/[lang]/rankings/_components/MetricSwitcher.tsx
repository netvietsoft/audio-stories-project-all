"use client";

import React from 'react';
import { RANKING_METRICS, RankingMetricKey } from '@/lib/ranking-metrics';

export default function MetricSwitcher({
  value,
  onChange,
}: {
  value: RankingMetricKey;
  onChange: (key: RankingMetricKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {RANKING_METRICS.map((m) => {
        const active = m.key === value;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-pink-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
