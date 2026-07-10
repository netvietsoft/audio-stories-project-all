"use client";

import React, { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';
import { RankingMetricKey, getMetric, formatMetricValue } from '@/lib/ranking-metrics';
import { countryName } from '@/lib/country-name';
import MetricSwitcher from '../_components/MetricSwitcher';
import RankingTable, { RankingStoryRow } from '../_components/RankingTable';

interface CountryOption { code: string; name: string; }

export default function StoriesByCountryRankingPage() {
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [country, setCountry] = useState<string>('');
  const [metricKey, setMetricKey] = useState<RankingMetricKey>('reads');
  const [rows, setRows] = useState<RankingStoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [countriesLoaded, setCountriesLoaded] = useState(false);

  const metric = getMetric(metricKey);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get(`/stats/top-countries?metric=view&limit=100`)
      .then((res) => {
        const list = unwrapList<{ country: string }>(res.data)
          .map((r) => ({ code: r.country, name: countryName(r.country) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        if (!cancelled) {
          setCountryOptions(list);
          if (list.length > 0) setCountry((cur) => cur || list[0].code);
        }
      })
      .catch(() => { if (!cancelled) setCountryOptions([]); })
      .finally(() => { if (!cancelled) setCountriesLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!country) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .get(`/stats/top-stories-by-country?country=${encodeURIComponent(country)}&metric=${metric.geoKind}&limit=100`)
      .then((res) => { if (!cancelled) setRows(unwrapList<RankingStoryRow>(res.data)); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [country, metric.geoKind]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-pink-700">
          <Globe2 className="h-3.5 w-3.5" /> Bảng xếp hạng
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Xếp hạng theo quốc gia</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-500">Chọn một quốc gia để xem top 100 truyện trong quốc gia đó theo chỉ số.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative max-w-sm">
          <Globe2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={countryOptions.length === 0}
            className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-100 disabled:opacity-50"
          >
            {countryOptions.length === 0 ? (
              <option value="">Chưa có dữ liệu quốc gia nào</option>
            ) : (
              countryOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.name} ({o.code})</option>
              ))
            )}
          </select>
        </div>

        <MetricSwitcher value={metricKey} onChange={setMetricKey} />
      </div>

      {!countriesLoaded ? (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">Đang tải danh sách quốc gia…</div>
      ) : !country ? (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">Chọn một quốc gia để xem xếp hạng.</div>
      ) : loading ? (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">Đang tải dữ liệu…</div>
      ) : (
        <RankingTable rows={rows} metricLabel={metric.label} formatValue={(v) => formatMetricValue(metric, v)} />
      )}
    </div>
  );
}
