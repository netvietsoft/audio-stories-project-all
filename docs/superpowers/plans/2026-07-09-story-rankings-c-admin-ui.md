# Story Rankings — Sub-project C (Admin ranking UIs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 3 admin ranking screens (Top Truyện, Top Quốc gia, Xếp hạng theo quốc gia) that consume the shipped `/stats/*` endpoints, plus a small backend addition (trending-per-country) so all three offer the full 9 metrics.

**Architecture:** Backend adds a `metric==='trending'` branch to the 3 geo service methods (decay over `kind='view'`, mirroring the existing global-trending SQL) and widens the 3 geo DTOs' `@IsIn`. Frontend adds a shared metric-mapping module + country-name helper + two shared components (`MetricSwitcher`, `RankingTable`), 3 pages under `app/[lang]/rankings/`, and one sidebar nav group. Everything mirrors the existing `vip-stories/page.tsx` conventions.

**Tech Stack:** NestJS + Prisma raw SQL (MySQL) + jest (backend); Next.js 16 / React 19 + Tailwind + axios + lucide-react (admin FE).

## Global Constraints

- **No database migration.** Trending-per-country reuses the existing `story_country_daily` table (`kind='view'` buckets). Do not create or run any migration.
- **Decay expression MUST match global-trending verbatim:** `SUM(count * POW(0.9, DATEDIFF(UTC_DATE(), date)))` over `kind='view'`, windowed `date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY)`. (Source: `getTopStoriesAggregated` trending branch in `be/src/stats/stats.service.ts`.)
- **9-metric mapping is the single source of truth** (`fe/apps/admin/src/lib/ranking-metrics.ts`): `reads→view`, `rating→rating`, `comments→comment`, `favorites→favorite`, `gifts→gift`, `trending→trending`, `search→search`, `revenue→revenue`, `audio→listen`. `storyMetric` feeds `/stats/top-stories`; `geoKind` feeds the 3 geo endpoints.
- **Admin API access:** use `adminApiClient` from `@/lib/api/admin-api-client` (its response interceptor is pass-through — no unwrapping). Always extract arrays with `unwrapList` from `@/lib/api/unwrap`. `res.data` is the BE body `{ data: [...] }`.
- **Path alias:** `@/*` maps to `fe/apps/admin/src/*`.
- **Style:** mirror `vip-stories/page.tsx` — pink/slate cards, `rounded-[24px]`/`rounded-[32px]`, `font-black`, loading/empty states as dashed cards. Admin UI copy is Vietnamese.
- **Country display:** always render 2-letter ISO codes through `countryName()` (`Intl.DisplayNames(['vi'], { type:'region' })`), which falls back to the uppercased code.
- **FE has no unit-test runner** (no jest/vitest in `fe/apps/admin`). The verification gate for every FE task is `tsc --noEmit` returning exit 0 (baseline is currently clean) plus the manual smoke checklist in the final task. Do NOT add a test runner.
- **Value formatting:** `rating` → 2 decimals; `trending` → rounded integer with thousands separators; all other metrics → integer `toLocaleString('vi-VN')`. Encapsulated in `formatMetricValue`.

**Command reference:**
- Backend jest (run from `be/`): `node node_modules/jest/bin/jest.js src/stats/geo-rankings.spec.ts`
- Backend typecheck (from `be/`): `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- Admin typecheck (from `fe/apps/admin/`): `../../node_modules/.bin/tsc --noEmit -p tsconfig.json` (expect no output, exit 0)

---

## File Structure

**Backend (modify):**
- `be/src/stats/dto/top-countries-query.dto.ts` — add `'trending'` to metric union + `@IsIn`.
- `be/src/stats/dto/stories-by-country-query.dto.ts` — same.
- `be/src/stats/dto/story-top-countries-query.dto.ts` — same.
- `be/src/stats/stats.service.ts` — add trending branch to `getTopCountries`, `getTopStoriesByCountry`, `getStoryTopCountries`.
- `be/src/stats/geo-rankings.spec.ts` — append trending + DTO-validation tests.

**Frontend (create):**
- `fe/apps/admin/src/lib/country-name.ts` — `countryName(code)` helper.
- `fe/apps/admin/src/lib/ranking-metrics.ts` — `RANKING_METRICS`, `RankingMetricKey`, `getMetric`, `formatMetricValue`.
- `fe/apps/admin/src/app/[lang]/rankings/_components/MetricSwitcher.tsx` — pill metric selector.
- `fe/apps/admin/src/app/[lang]/rankings/_components/RankingTable.tsx` — shared story ranking table (optional row-expand).
- `fe/apps/admin/src/app/[lang]/rankings/top-stories/page.tsx` — Top Truyện.
- `fe/apps/admin/src/app/[lang]/rankings/top-countries/page.tsx` — Top Quốc gia.
- `fe/apps/admin/src/app/[lang]/rankings/by-country/page.tsx` — Xếp hạng theo quốc gia.

**Frontend (modify):**
- `fe/apps/admin/src/components/admin/AdminShellLayout.tsx` — add `BarChart3` import + "Bảng xếp hạng" nav group.

---

## Task 1: Backend — trending-per-country (DTOs + service branches + tests)

**Files:**
- Modify: `be/src/stats/stats.service.ts` (methods `getTopCountries`, `getTopStoriesByCountry`, `getStoryTopCountries`)
- Modify: `be/src/stats/dto/top-countries-query.dto.ts`
- Modify: `be/src/stats/dto/stories-by-country-query.dto.ts`
- Modify: `be/src/stats/dto/story-top-countries-query.dto.ts`
- Test: `be/src/stats/geo-rankings.spec.ts`

**Interfaces:**
- Consumes: existing `StatsService` methods with signatures `getTopCountries(q: { metric: string; limit?: number })`, `getTopStoriesByCountry(q: { country: string; metric: string; limit?: number })`, `getStoryTopCountries(q: { storyId: string; metric?: string; limit?: number })`. All return `{ data: [...] }`.
- Produces: those same methods, now accepting `metric='trending'`. Response shapes UNCHANGED — `getTopCountries` → `{ data: [{ rank, country, value }] }`; `getTopStoriesByCountry` → `{ data: [{ rank, storyId, title, slug, thumbnailUrl, value }] }`; `getStoryTopCountries` → `{ data: [{ country, value }] }`. The 3 geo DTOs accept `'trending'` in addition to the existing 8 kinds.

- [ ] **Step 1: Add trending tests to the spec file**

Add these imports at the TOP of `be/src/stats/geo-rankings.spec.ts` (below the existing `import { StatsService } from './stats.service';`):

```typescript
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TopCountriesQueryDto } from './dto/top-countries-query.dto';
```

Then add these `it(...)` blocks INSIDE the existing `describe('geo rankings', () => { ... })` block, after the last existing test:

```typescript
  it('getTopCountries trending: decays kind=view buckets and returns shaped rows', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 12 }, { country: 'US', value: 3 }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    const res = await svc.getTopCountries({ metric: 'trending', limit: 20 });
    expect(res.data).toEqual([{ rank: 1, country: 'VN', value: 12 }, { rank: 2, country: 'US', value: 3 }]);
    const sql = $queryRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain('POW(0.9');
    expect(sql).toContain("kind = 'view'");
  });

  it('getTopCountries non-trending: uses SUM(count) with kind param, no decay', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 9n }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    await svc.getTopCountries({ metric: 'view', limit: 20 });
    const sql = $queryRaw.mock.calls[0][0].join(' ');
    expect(sql).not.toContain('POW(0.9');
  });

  it('getStoryTopCountries trending: decays kind=view buckets', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 5 }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    const res = await svc.getStoryTopCountries({ storyId: 's1', metric: 'trending', limit: 5 });
    expect(res.data).toEqual([{ country: 'VN', value: 5 }]);
    const sql = $queryRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain('POW(0.9');
    expect(sql).toContain("kind = 'view'");
  });

  it('getTopStoriesByCountry trending: decays kind=view, hydrates in SQL order', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'x', value: 7 }, { id: 'y', value: 3 }]);
    const findMany = jest.fn().mockResolvedValue([
      { id: 'y', title: 'Y', slug: 'y', thumbnailUrl: null },
      { id: 'x', title: 'X', slug: 'x', thumbnailUrl: 't' },
    ]);
    const prisma: any = { $queryRaw: queryRaw, story: { findMany } };
    const svc = new StatsService(prisma);
    const res = await svc.getTopStoriesByCountry({ country: 'VN', metric: 'trending', limit: 100 });
    expect(res.data[0]).toEqual({ rank: 1, storyId: 'x', title: 'X', slug: 'x', thumbnailUrl: 't', value: 7 });
    const sql = queryRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain('POW(0.9');
    expect(sql).toContain("scd.kind = 'view'");
  });

  it('TopCountriesQueryDto accepts metric=trending', async () => {
    const dto = plainToInstance(TopCountriesQueryDto, { metric: 'trending', limit: 20 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('TopCountriesQueryDto rejects an unknown metric', async () => {
    const dto = plainToInstance(TopCountriesQueryDto, { metric: 'nope' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `be/`): `node node_modules/jest/bin/jest.js src/stats/geo-rankings.spec.ts`

Expected: the 4 trending service tests FAIL (current SQL has no `POW(0.9` for trending; `metric='trending'` falls into the plain branch and produces `kind = ${'trending'}`, so `story_country_daily` has no `kind='trending'` rows → the SQL-text assertions `toContain('POW(0.9')` fail). The `TopCountriesQueryDto accepts metric=trending` test FAILS (current `@IsIn` lacks `'trending'`). The "rejects unknown" and "non-trending no decay" tests may already pass — that's fine.

- [ ] **Step 3: Widen the 3 geo DTOs**

In `be/src/stats/dto/top-countries-query.dto.ts`, replace the `metric` decorator + type with:

```typescript
  @IsIn(['view', 'search', 'favorite', 'comment', 'rating', 'gift', 'revenue', 'listen', 'trending'])
  metric: 'view' | 'search' | 'favorite' | 'comment' | 'rating' | 'gift' | 'revenue' | 'listen' | 'trending';
```

In `be/src/stats/dto/stories-by-country-query.dto.ts`, replace the `metric` decorator + type with the identical two lines above.

In `be/src/stats/dto/story-top-countries-query.dto.ts`, replace the `metric` decorator + type with (keep `@IsOptional` and the `= 'view'` default):

```typescript
  @IsOptional() @IsIn(['view', 'search', 'favorite', 'comment', 'rating', 'gift', 'revenue', 'listen', 'trending'])
  metric?: 'view' | 'search' | 'favorite' | 'comment' | 'rating' | 'gift' | 'revenue' | 'listen' | 'trending' = 'view';
```

- [ ] **Step 4: Add the trending branch to `getTopCountries`**

In `be/src/stats/stats.service.ts`, replace the whole `getTopCountries` method with:

```typescript
    async getTopCountries(q: { metric: string; limit?: number }) {
        const limit = Math.min(q.limit ?? 20, 100);
        const rows = q.metric === 'trending'
            ? await this.prisma.$queryRaw<Array<{ country: string; value: any }>>`
                SELECT country, SUM(count * POW(0.9, DATEDIFF(UTC_DATE(), date))) AS value
                FROM story_country_daily
                WHERE kind = 'view' AND date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY)
                GROUP BY country ORDER BY value DESC LIMIT ${limit}`
            : await this.prisma.$queryRaw<Array<{ country: string; value: bigint }>>`
                SELECT country, SUM(count) AS value FROM story_country_daily
                WHERE kind = ${q.metric} GROUP BY country ORDER BY value DESC LIMIT ${limit}`;
        return { data: rows.map((r, i) => ({ rank: i + 1, country: r.country, value: Number(r.value ?? 0) })) };
    }
```

- [ ] **Step 5: Add the trending branch to `getTopStoriesByCountry`**

Replace the whole `getTopStoriesByCountry` method with:

```typescript
    async getTopStoriesByCountry(q: { country: string; metric: string; limit?: number }) {
        const limit = Math.min(q.limit ?? 100, 100);
        const rows = q.metric === 'trending'
            ? await this.prisma.$queryRaw<Array<{ id: string; value: any }>>`
                SELECT scd.story_id AS id, SUM(scd.count * POW(0.9, DATEDIFF(UTC_DATE(), scd.date))) AS value
                FROM story_country_daily scd JOIN stories s ON s.id = scd.story_id
                WHERE scd.kind = 'view' AND scd.country = ${q.country}
                  AND scd.date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY) AND s.deleted_at IS NULL
                GROUP BY scd.story_id ORDER BY value DESC LIMIT ${limit}`
            : await this.prisma.$queryRaw<Array<{ id: string; value: bigint }>>`
                SELECT scd.story_id AS id, SUM(scd.count) AS value
                FROM story_country_daily scd JOIN stories s ON s.id = scd.story_id
                WHERE scd.kind = ${q.metric} AND scd.country = ${q.country} AND s.deleted_at IS NULL
                GROUP BY scd.story_id ORDER BY value DESC LIMIT ${limit}`;
        if (!rows.length) return { data: [] };
        const stories = await this.prisma.story.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: { id: true, title: true, slug: true, thumbnailUrl: true } });
        const byId = new Map(stories.map((s) => [s.id, s]));
        return { data: rows.map((r, i) => { const s = byId.get(r.id); return { rank: i + 1, storyId: r.id, title: s?.title ?? '', slug: s?.slug ?? '', thumbnailUrl: s?.thumbnailUrl ?? null, value: Number(r.value ?? 0) }; }) };
    }
```

- [ ] **Step 6: Add the trending branch to `getStoryTopCountries`**

Replace the whole `getStoryTopCountries` method with:

```typescript
    async getStoryTopCountries(q: { storyId: string; metric?: string; limit?: number }) {
        const limit = Math.min(q.limit ?? 5, 50);
        const kind = q.metric ?? 'view';
        const rows = kind === 'trending'
            ? await this.prisma.$queryRaw<Array<{ country: string; value: any }>>`
                SELECT country, SUM(count * POW(0.9, DATEDIFF(UTC_DATE(), date))) AS value FROM story_country_daily
                WHERE story_id = ${q.storyId} AND kind = 'view' AND date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY)
                GROUP BY country ORDER BY value DESC LIMIT ${limit}`
            : await this.prisma.$queryRaw<Array<{ country: string; value: bigint }>>`
                SELECT country, SUM(count) AS value FROM story_country_daily
                WHERE story_id = ${q.storyId} AND kind = ${kind} GROUP BY country ORDER BY value DESC LIMIT ${limit}`;
        return { data: rows.map((r) => ({ country: r.country, value: Number(r.value ?? 0) })) };
    }
```

- [ ] **Step 7: Run tests to verify they pass**

Run (from `be/`): `node node_modules/jest/bin/jest.js src/stats/geo-rankings.spec.ts`
Expected: all tests PASS (the original 5 + the 6 new ones = 11 passing).

- [ ] **Step 8: Typecheck the backend**

Run (from `be/`): `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 9: Commit**

```bash
git add be/src/stats/stats.service.ts be/src/stats/dto/top-countries-query.dto.ts be/src/stats/dto/stories-by-country-query.dto.ts be/src/stats/dto/story-top-countries-query.dto.ts be/src/stats/geo-rankings.spec.ts
git commit -m "feat(stats): trending-per-country for geo ranking endpoints"
```

---

## Task 2: FE shared foundations — country-name + ranking-metrics

**Files:**
- Create: `fe/apps/admin/src/lib/country-name.ts`
- Create: `fe/apps/admin/src/lib/ranking-metrics.ts`

**Interfaces:**
- Produces: `countryName(code: string): string`. `RankingMetricKey` (union of 9 keys). `RankingMetric` interface `{ key: RankingMetricKey; label: string; storyMetric: string; geoKind: string; isDecimal?: boolean }`. `RANKING_METRICS: RankingMetric[]` (9 entries, order = display order, `reads` first). `getMetric(key: RankingMetricKey): RankingMetric`. `formatMetricValue(metric: RankingMetric, value: number): string`.
- Consumed by: Tasks 3–6.

- [ ] **Step 1: Create `country-name.ts`**

```typescript
// Đổi mã ISO 2 ký tự (VN, US) sang tên quốc gia tiếng Việt; fallback về mã in hoa.
const displayNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['vi'], { type: 'region' })
    : null;

export function countryName(code: string): string {
  if (!code) return '';
  const upper = code.toUpperCase();
  try {
    return displayNames?.of(upper) ?? upper;
  } catch {
    return upper;
  }
}
```

- [ ] **Step 2: Create `ranking-metrics.ts`**

```typescript
export type RankingMetricKey =
  | 'reads' | 'rating' | 'comments' | 'favorites' | 'gifts'
  | 'trending' | 'search' | 'revenue' | 'audio';

export interface RankingMetric {
  key: RankingMetricKey;
  label: string;
  /** tham số cho /stats/top-stories?metric= */
  storyMetric: string;
  /** kind cho 3 endpoint geo (top-countries / top-stories-by-country / story-top-countries) */
  geoKind: string;
  /** value là số thực (rating/trending) -> format khác số đếm */
  isDecimal?: boolean;
}

export const RANKING_METRICS: RankingMetric[] = [
  { key: 'reads', label: 'Đọc nhiều', storyMetric: 'reads', geoKind: 'view' },
  { key: 'rating', label: 'Đánh giá', storyMetric: 'rating', geoKind: 'rating', isDecimal: true },
  { key: 'comments', label: 'Bình luận', storyMetric: 'comments', geoKind: 'comment' },
  { key: 'favorites', label: 'Yêu thích', storyMetric: 'favorites', geoKind: 'favorite' },
  { key: 'gifts', label: 'Tặng quà', storyMetric: 'gifts', geoKind: 'gift' },
  { key: 'trending', label: 'Xu hướng', storyMetric: 'trending', geoKind: 'trending', isDecimal: true },
  { key: 'search', label: 'Tìm kiếm', storyMetric: 'search', geoKind: 'search' },
  { key: 'revenue', label: 'Doanh thu', storyMetric: 'revenue', geoKind: 'revenue' },
  { key: 'audio', label: 'Nghe audio', storyMetric: 'audio', geoKind: 'listen' },
];

export function getMetric(key: RankingMetricKey): RankingMetric {
  return RANKING_METRICS.find((m) => m.key === key) ?? RANKING_METRICS[0];
}

export function formatMetricValue(metric: RankingMetric, value: number): string {
  const v = value ?? 0;
  if (metric.key === 'rating') return v.toFixed(2);
  if (metric.key === 'trending') return Math.round(v).toLocaleString('vi-VN');
  return v.toLocaleString('vi-VN');
}
```

- [ ] **Step 3: Typecheck**

Run (from `fe/apps/admin/`): `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add fe/apps/admin/src/lib/country-name.ts fe/apps/admin/src/lib/ranking-metrics.ts
git commit -m "feat(admin): ranking metric mapping + country-name helper"
```

---

## Task 3: FE shared components — MetricSwitcher + RankingTable

**Files:**
- Create: `fe/apps/admin/src/app/[lang]/rankings/_components/MetricSwitcher.tsx`
- Create: `fe/apps/admin/src/app/[lang]/rankings/_components/RankingTable.tsx`

**Interfaces:**
- Consumes: `RANKING_METRICS`, `RankingMetricKey` from `@/lib/ranking-metrics` (Task 2).
- Produces:
  - `MetricSwitcher` — default export. Props `{ value: RankingMetricKey; onChange: (key: RankingMetricKey) => void }`.
  - `RankingTable` — default export. Props `{ rows: RankingStoryRow[]; metricLabel: string; formatValue: (value: number) => string; renderExpand?: (storyId: string) => React.ReactNode; onExpand?: (storyId: string) => void }`. Named export `RankingStoryRow` = `{ rank: number; storyId: string; title: string; slug: string; thumbnailUrl: string | null; value: number }`. When `renderExpand` is provided, each row is a `<details>` with a chevron; opening a row calls `onExpand(storyId)` once (via `onToggle`); `renderExpand(storyId)` renders the expand body from caller state. When `renderExpand` is absent, rows are plain non-expandable cards. Empty `rows` renders the "Không có dữ liệu." dashed card.
- Consumed by: Tasks 4 (both props) and 6 (no expand).

- [ ] **Step 1: Create `MetricSwitcher.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `RankingTable.tsx`**

```tsx
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
```

- [ ] **Step 3: Typecheck**

Run (from `fe/apps/admin/`): `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add "fe/apps/admin/src/app/[lang]/rankings/_components/MetricSwitcher.tsx" "fe/apps/admin/src/app/[lang]/rankings/_components/RankingTable.tsx"
git commit -m "feat(admin): shared MetricSwitcher + RankingTable components"
```

---

## Task 4: FE page — Top Truyện (with lazy top-5-countries expand)

**Files:**
- Create: `fe/apps/admin/src/app/[lang]/rankings/top-stories/page.tsx`

**Interfaces:**
- Consumes: `adminApiClient` (`@/lib/api/admin-api-client`), `unwrapList` (`@/lib/api/unwrap`), `RankingMetricKey`/`getMetric`/`formatMetricValue` (`@/lib/ranking-metrics`), `countryName` (`@/lib/country-name`), `MetricSwitcher` + `RankingTable`/`RankingStoryRow` (Task 3).
- Endpoints: `GET /stats/top-stories?metric=<storyMetric>&limit=100`; on row-expand `GET /stats/story-top-countries?storyId=<id>&metric=<geoKind>&limit=5`.
- Behavior: default metric `reads`. Switching metric refetches and resets the expand cache; `RankingTable` is force-remounted via `key={metricKey}` so any open rows reset to closed. Expand fetch is deduped (skip if already loading/loaded) and fails silently to "—".

- [ ] **Step 1: Create `top-stories/page.tsx`**

```tsx
"use client";

import React, { useEffect, useState } from 'react';
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
    setExpanded((prev) => ({ ...prev, [storyId]: { loading: true, countries: [] } }));
    apiClient
      .get(`/stats/story-top-countries?storyId=${encodeURIComponent(storyId)}&metric=${metric.geoKind}&limit=5`)
      .then((res) => {
        const list = unwrapList<CountryValue>(res.data);
        setExpanded((prev) => ({ ...prev, [storyId]: { loading: false, countries: list } }));
      })
      .catch(() => {
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
```

- [ ] **Step 2: Typecheck**

Run (from `fe/apps/admin/`): `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add "fe/apps/admin/src/app/[lang]/rankings/top-stories/page.tsx"
git commit -m "feat(admin): Top Truyện ranking page"
```

---

## Task 5: FE page — Top Quốc gia

**Files:**
- Create: `fe/apps/admin/src/app/[lang]/rankings/top-countries/page.tsx`

**Interfaces:**
- Consumes: `adminApiClient`, `unwrapList`, `RankingMetricKey`/`getMetric`/`formatMetricValue`, `countryName`, `MetricSwitcher` (Task 3). Does NOT use `RankingTable` (renders its own simple country rows).
- Endpoint: `GET /stats/top-countries?metric=<geoKind>&limit=20` → `{ data: [{ rank, country, value }] }`.
- Behavior: default metric `reads` (geoKind `view`). Loading + empty states.

- [ ] **Step 1: Create `top-countries/page.tsx`**

```tsx
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
                <p className="text-lg font-black text-pink-600">{formatMetricValue(metric, row.value)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `fe/apps/admin/`): `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add "fe/apps/admin/src/app/[lang]/rankings/top-countries/page.tsx"
git commit -m "feat(admin): Top Quốc gia ranking page"
```

---

## Task 6: FE page — Xếp hạng theo quốc gia

**Files:**
- Create: `fe/apps/admin/src/app/[lang]/rankings/by-country/page.tsx`

**Interfaces:**
- Consumes: `adminApiClient`, `unwrapList`, `RankingMetricKey`/`getMetric`/`formatMetricValue`, `countryName`, `MetricSwitcher`, `RankingTable`/`RankingStoryRow` (no expand).
- Endpoints: country list `GET /stats/top-countries?metric=view&limit=100` (once); rankings `GET /stats/top-stories-by-country?country=XX&metric=<geoKind>&limit=100`.
- Behavior: load country options once, localized + sorted by name; default-select the first (most views). Refetch rankings when country or metric changes. States: countries loading → country empty → rankings loading → RankingTable.

- [ ] **Step 1: Create `by-country/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run (from `fe/apps/admin/`): `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add "fe/apps/admin/src/app/[lang]/rankings/by-country/page.tsx"
git commit -m "feat(admin): Xếp hạng theo quốc gia ranking page"
```

---

## Task 7: FE nav — "Bảng xếp hạng" group + manual smoke

**Files:**
- Modify: `fe/apps/admin/src/components/admin/AdminShellLayout.tsx`

**Interfaces:**
- Consumes: the 3 routes created in Tasks 4–6 (`/rankings/top-stories`, `/rankings/top-countries`, `/rankings/by-country`). The existing `NavGroup` machinery (accordion, active detection) needs only new data.
- Produces: a new collapsible sidebar group visible in the admin shell.

- [ ] **Step 1: Add the `BarChart3` icon to the lucide-react import**

In `fe/apps/admin/src/components/admin/AdminShellLayout.tsx`, the import on line 6 ends with `..., Share2, Tag } from 'lucide-react';`. Add `BarChart3`:

Change `Share2, Tag }` to `Share2, Tag, BarChart3 }`.

- [ ] **Step 2: Insert the nav group**

In the `navItems` array, insert this entry immediately AFTER the `{ href: '/vip-stories', label: 'Thống kê Truyện VIP', icon: Crown },` line and BEFORE `{ href: '/settings', label: 'Cài đặt', icon: Settings },`:

```tsx
        {
            label: 'Bảng xếp hạng',
            icon: BarChart3,
            children: [
                { href: '/rankings/top-stories', label: 'Top Truyện', icon: Newspaper },
                { href: '/rankings/top-countries', label: 'Top Quốc gia', icon: Globe2 },
                { href: '/rankings/by-country', label: 'Xếp hạng theo quốc gia', icon: Globe2 },
            ],
        },
```

(`Newspaper` and `Globe2` are already imported. `BarChart3` was added in Step 1.)

- [ ] **Step 3: Typecheck**

Run (from `fe/apps/admin/`): `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 4: Manual smoke (dev server on port 9003)**

Start the admin dev server if not running (from `fe/`): `node_modules/.bin/next dev` is wrapped by the app's `dev` script (`next dev -p 9003`). With the backend on 9001, log into the admin, then verify:
1. Sidebar shows a "Bảng xếp hạng" group; expanding it lists Top Truyện / Top Quốc gia / Xếp hạng theo quốc gia.
2. **Top Truyện**: loads a ranked list; switching metric pills refetches; clicking a row expands and shows up to 5 countries with Vietnamese names + values ("Việt Nam: …"); switching metric collapses rows and resets.
3. **Top Quốc gia**: loads up to 20 countries with Vietnamese names; metric switch refetches.
4. **Xếp hạng theo quốc gia**: country dropdown is populated (Vietnamese names + code); selecting a country + metric loads up to 100 stories.
5. Empty dev data is acceptable — screens must show the "Chưa có dữ liệu…" states without errors, not crash. (Backend geo tables may be sparse in dev.)

- [ ] **Step 5: Commit**

```bash
git add "fe/apps/admin/src/components/admin/AdminShellLayout.tsx"
git commit -m "feat(admin): add Bảng xếp hạng nav group"
```

---

## Notes / follow-ups (not in scope)
- No migration for C. (A/B1/B2a migrations still pending prod deploy: `labels`+`stories.label_id`, `story_view_daily`, `story_country_daily`.)
- Optional later: language filter on Top Truyện (endpoint already accepts `language`); `story-top-countries` DTO `@Max(50)`; `getTopCountries` `deleted_at` exclusion.
