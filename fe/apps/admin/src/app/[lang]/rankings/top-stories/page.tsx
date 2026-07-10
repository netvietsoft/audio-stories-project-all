"use client";

import React, { useEffect, useRef, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';
import { RankingMetricKey, getMetric, formatMetricValue } from '@/lib/ranking-metrics';
import { countryName } from '@/lib/country-name';
import MetricSwitcher from '../_components/MetricSwitcher';
import RankingTable, { RankingStoryRow } from '../_components/RankingTable';

interface CountryValue { country: string; value: number; }
interface ExpandState { loading: boolean; countries: CountryValue[]; error?: boolean; }

export default function TopStoriesRankingPage() {
  const [metricKey, setMetricKey] = useState<RankingMetricKey>('reads');
  const [rows, setRows] = useState<RankingStoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, ExpandState>>({});

  const metric = getMetric(metricKey);
  const metricKeyRef = useRef(metricKey);
  metricKeyRef.current = metricKey;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExpanded({});
    apiClient
      .get(`/stats/top-stories?metric=${metric.storyMetric}&limit=100`)
      .then((res) => { if (!cancelled) setRows(unwrapList<RankingStoryRow>(res.data)); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [metric.storyMetric]);

  const handleExpand = (storyId: string) => {
    if (expanded[storyId]) return; // đã nạp / đang nạp
    const requested = metricKey;
    setExpanded((prev) => ({ ...prev, [storyId]: { loading: true, countries: [] } }));
    apiClient
      .get(`/stats/story-top-countries?storyId=${encodeURIComponent(storyId)}&metric=${metric.geoKind}&limit=5`)
      .then((res) => {
        if (metricKeyRef.current !== requested) return; // metric đã đổi giữa chừng -> bỏ qua kết quả cũ
        const list = unwrapList<CountryValue>(res.data);
        setExpanded((prev) => ({ ...prev, [storyId]: { loading: false, countries: list } }));
      })
      .catch(() => {
        if (metricKeyRef.current !== requested) return;
        setExpanded((prev) => ({ ...prev, [storyId]: { loading: false, countries: [], error: true } }));
      });
  };

  const renderExpand = (storyId: string) => {
    const state = expanded[storyId];
    if (!state || state.loading) return <p className="text-xs font-medium text-slate-400">Đang tải…</p>;
    if (state.error) return <p className="text-xs font-medium text-slate-400">—</p>;
    if (state.countries.length === 0) return <p className="text-xs font-medium text-slate-400">Chưa có dữ liệu quốc gia.</p>;
    return (
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Top 5 quốc gia · {metric.label}</p>
        <div className="flex flex-wrap gap-2">
          {state.countries.map((c) => (
            <span key={c.country} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
              {countryName(c.country)}: {formatMetricValue(metric, c.value)}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-pink-700">
          <BarChart3 className="h-3.5 w-3.5" /> Bảng xếp hạng
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Top Truyện</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-500">
          Xếp hạng 100 truyện theo chỉ số. Bấm vào một truyện để xem top 5 quốc gia theo chỉ số đang chọn.
        </p>
      </div>

      <MetricSwitcher value={metricKey} onChange={setMetricKey} />

      {loading ? (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">
          Đang tải dữ liệu…
        </div>
      ) : (
        <RankingTable
          key={metricKey}
          rows={rows}
          metricLabel={metric.label}
          formatValue={(v) => formatMetricValue(metric, v)}
          renderExpand={renderExpand}
          onExpand={handleExpand}
        />
      )}
    </div>
  );
}
