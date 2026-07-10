"use client";

import React, { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';
import { RankingMetricKey, getMetric, formatMetricValue } from '@/lib/ranking-metrics';
import { countryName } from '@/lib/country-name';
import MetricSwitcher from '../_components/MetricSwitcher';

interface CountryRow { rank: number; country: string; value: number; }

export default function TopCountriesRankingPage() {
  const [metricKey, setMetricKey] = useState<RankingMetricKey>('reads');
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const metric = getMetric(metricKey);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get(`/stats/top-countries?metric=${metric.geoKind}&limit=20`)
      .then((res) => { if (!cancelled) setRows(unwrapList<CountryRow>(res.data)); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [metric.geoKind]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-pink-700">
          <Globe2 className="h-3.5 w-3.5" /> Bảng xếp hạng
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Top Quốc gia</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-500">Xếp hạng 20 quốc gia theo chỉ số.</p>
      </div>

      <MetricSwitcher value={metricKey} onChange={setMetricKey} />

      {loading ? (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">Đang tải dữ liệu…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">Chưa có dữ liệu quốc gia nào.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.country} className="flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <span className="w-10 shrink-0 text-center text-lg font-black text-slate-400">{row.rank}</span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-bold text-slate-900">{countryName(row.country)}</h3>
                <p className="text-xs font-medium text-slate-400">{row.country}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{metric.label}</p>
                <p className="text-lg font-black text-pink-600">{formatMetricValue(metric, row.value, true)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
