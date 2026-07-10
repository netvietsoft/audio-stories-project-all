"use client";

import React from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';

export interface RankingStoryRow {
  rank: number;
  storyId: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  value: number;
}

export default function RankingTable({
  rows,
  metricLabel,
  formatValue,
  renderExpand,
  onExpand,
}: {
  rows: RankingStoryRow[];
  metricLabel: string;
  formatValue: (value: number) => string;
  renderExpand?: (storyId: string) => React.ReactNode;
  onExpand?: (storyId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">
        Không có dữ liệu.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const header = (
          <div className="flex items-center gap-4">
            <span className="w-10 shrink-0 text-center text-lg font-black text-slate-400">{row.rank}</span>
            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {row.thumbnailUrl ? (
                <img src={row.thumbnailUrl} alt={row.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <BookOpen className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-bold text-slate-900">{row.title || 'Không rõ tiêu đề'}</h3>
              <p className="truncate text-xs font-medium text-slate-400">{row.slug}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{metricLabel}</p>
              <p className="text-lg font-black text-pink-600">{formatValue(row.value)}</p>
            </div>
            {renderExpand && <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />}
          </div>
        );

        if (!renderExpand) {
          return (
            <div key={row.storyId} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              {header}
            </div>
          );
        }

        return (
          <details
            key={row.storyId}
            className="group rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) onExpand?.(row.storyId);
            }}
          >
            <summary className="flex cursor-pointer list-none items-center">{header}</summary>
            <div className="mt-4 border-t border-slate-100 pt-4">{renderExpand(row.storyId)}</div>
          </details>
        );
      })}
    </div>
  );
}
