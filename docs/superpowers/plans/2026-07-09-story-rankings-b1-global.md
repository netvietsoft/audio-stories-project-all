# Story Rankings B1 (Global Metrics) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 8 story metrics rankable globally via one admin endpoint `GET /stats/top-stories?metric=…&limit=…&language=…`, including a real 30-day decay trending score fed by a new daily-view-bucket table.

**Architecture:** Extend the existing `StatsService`/`StatsController` (mirroring `getVipChapterStats`'s `$queryRaw` raw-SQL precedent). Counter-backed metrics (reads/favorites/gifts) rank via `prisma.story.findMany`; comments/audio/revenue/trending/rating use raw SQL aggregation. A new `StoryViewDaily` table is fed by the existing 5-minute `flushTrackingCounters` cron (upserts today's per-story bucket alongside the `totalViews` increment).

**Tech Stack:** NestJS + Prisma (MySQL) + jest (`node node_modules/jest/bin/jest.js` from `be/`). Raw SQL via `this.prisma.$queryRaw` tagged templates (+ `Prisma.sql`/`Prisma.empty` for conditional fragments).

## Global Constraints

- **Repo:** `D:\SetupC\Projects\NovelApp\backend`, all commands from `be/`. On `master`, local commits only, do NOT push.
- **Prisma naming:** snake_case `@map` on every column, `@@map` plural table, integer PKs `Int @db.UnsignedInt`; Story/Chapter ids are `String @db.VarChar(36)`. New FK `storyId` → `@map("story_id") @db.VarChar(36)`.
- **Admin guard:** the ranking endpoint uses `@UseGuards(JwtAccessGuard, RolesGuard) @Roles('ADMIN')` (mirror `StatsController.getVipChapterStats`).
- **Metrics (8) + exact definitions (from spec §3–4):** reads=`stories.total_views`; favorites=`stories.favorites_count`; gifts=`stories.total_gifts`; comments=`COUNT(chapter_comments WHERE is_hidden=0)` per story; audio=`COUNT(DISTINCT listening_history.user_id)` per story; revenue=`SUM(user_story_unlocks.pulse_amount) + SUM(user_chapter_unlocks.pulse_amount via chapters.story_id) + stories.total_gifts`; trending=`SUM(story_view_daily.views * POW(0.9, DATEDIFF(UTC_DATE(), date)))` over last 30 days; rating=Bayesian `(v/(v+m))*R + (m/(v+m))*C`, `m=10`, `C=AVG(average_rating) WHERE rating_count>0`, only stories with `rating_count>0`.
- **Always exclude** `stories.deleted_at IS NOT NULL`. `language` filter optional (by `languages.key`). `limit` default 100, clamp ≤100.
- **BigInt/Decimal from raw SQL** → `Number(row.x ?? 0)` for JSON.
- **Search + geo + admin UI are OUT of scope** (B2 / C).
- **Migration `.sql` is gitignored** → prod needs `prisma migrate deploy`. If `migrate dev` hangs on the shadow DB (dev server holds connections), stop the BE dev server on 9001 or apply the SQL directly + `prisma migrate resolve --applied <name>` (same as sub-project A).
- **Spec:** `docs/superpowers/specs/2026-07-09-story-rankings-b1-global-design.md`.

---

### Task 1: Prisma `StoryViewDaily` table + migration

**Files:**
- Modify: `be/prisma/schema.prisma` (add `model StoryViewDaily`; add back-relation to `model Story`)
- Migration: `be/prisma/migrations/<ts>_add_story_view_daily/`

**Interfaces:**
- Produces: Prisma model `StoryViewDaily { storyId: string, date: Date, views: number, story }` with compound id `[storyId, date]` (Prisma where-input key `storyId_date`).

- [ ] **Step 1: Add `model StoryViewDaily`** to `be/prisma/schema.prisma` (place near `model Story`):

```prisma
model StoryViewDaily {
  storyId String   @map("story_id") @db.VarChar(36)
  date    DateTime @db.Date
  views   Int      @default(0) @db.UnsignedInt

  story Story @relation(fields: [storyId], references: [id], onDelete: Cascade)

  @@id([storyId, date])
  @@index([date])
  @@map("story_view_daily")
}
```

- [ ] **Step 2: Add the back-relation** to `model Story`'s relation block (next to `storyUnlocks UserStoryUnlock[]`):

```prisma
  storyViewDaily StoryViewDaily[]
```

- [ ] **Step 3: Create + apply the migration** (from `be/`):

Run: `node node_modules/prisma/build/index.js migrate dev --name add_story_view_daily`
Expected: creates `story_view_daily` table + FK to `stories(id)` ON DELETE CASCADE, regenerates the client.
If it hangs on the shadow DB: stop the BE dev server on 9001, retry; or apply the SQL directly (`CREATE TABLE story_view_daily (story_id VARCHAR(36) NOT NULL, date DATE NOT NULL, views INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (story_id, date), INDEX story_view_daily_date_idx (date), CONSTRAINT story_view_daily_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE ON UPDATE CASCADE);`) via mysql then `node node_modules/prisma/build/index.js migrate resolve --applied add_story_view_daily`.

- [ ] **Step 4: Regenerate + typecheck** (from `be/`):

Run: `node node_modules/prisma/build/index.js generate`
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0 (client now has `prisma.storyViewDaily`).

- [ ] **Step 5: Commit**

```bash
git add be/prisma/schema.prisma be/prisma/migrations
git commit -m "feat(rankings): StoryViewDaily table + migration"
```

---

### Task 2: Feed `StoryViewDaily` from the tracking flush

**Files:**
- Modify: `be/src/tracking/tracking.service.ts` (add a pure arg-builder + wire into `flushTrackingCounters`)
- Test: `be/src/tracking/story-view-daily.spec.ts`

**Interfaces:**
- Consumes: `prisma.storyViewDaily` (Task 1).
- Produces: `buildDailyViewUpsertArgs(storyId: string, count: number, day: Date)` returning the exact `prisma.storyViewDaily.upsert(...)` args object.

- [ ] **Step 1: Write the failing test** — `be/src/tracking/story-view-daily.spec.ts`:

```ts
import { buildDailyViewUpsertArgs } from './tracking.service';

describe('buildDailyViewUpsertArgs', () => {
  it('builds an upsert keyed on (storyId, day) that increments views', () => {
    const day = new Date('2026-07-09T00:00:00.000Z');
    const args = buildDailyViewUpsertArgs('story-1', 5, day);
    expect(args).toEqual({
      where: { storyId_date: { storyId: 'story-1', date: day } },
      create: { storyId: 'story-1', date: day, views: 5 },
      update: { views: { increment: 5 } },
    });
  });
});
```

- [ ] **Step 2: Run → FAIL** (from `be/`):

Run: `node node_modules/jest/bin/jest.js src/tracking/story-view-daily.spec.ts`
Expected: FAIL (export not found).

- [ ] **Step 3: Add the exported pure helper** at the top of `be/src/tracking/tracking.service.ts` (after imports, before `@Injectable`):

```ts
export function buildDailyViewUpsertArgs(storyId: string, count: number, day: Date) {
  return {
    where: { storyId_date: { storyId, date: day } },
    create: { storyId, date: day, views: count },
    update: { views: { increment: count } },
  };
}
```

- [ ] **Step 4: Wire it into `flushTrackingCounters`.** Read the method first. (a) Declare a deltas array next to `const writes: any[] = [];`:

```ts
      const storyViewDeltas: Array<{ storyId: string; count: number }> = [];
```
(b) Change the STORY-prefix `collectByPrefix` call so its callback also records the delta (block body instead of arrow-expression):

```ts
      await collectByPrefix(storyKeys, this.STORY_VIEWS_PREFIX, (storyId, count) => {
        storyViewDeltas.push({ storyId, count });
        return this.prisma.story.updateMany({
          where: { id: storyId },
          data: { totalViews: { increment: count } },
        });
      });
```
(c) After the CHAPTER `collectByPrefix` call and BEFORE `if (writes.length > 0)`, append the daily-bucket upserts to the same transaction:

```ts
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      for (const { storyId, count } of storyViewDeltas) {
        writes.push(this.prisma.storyViewDaily.upsert(buildDailyViewUpsertArgs(storyId, count, today)));
      }
```
(Leave the existing `$transaction(writes)` + Redis-restore-on-failure logic unchanged — the daily upserts ride the same transaction, so a failure restores the Redis counters exactly as today.)

- [ ] **Step 5: Run test → PASS + typecheck** (from `be/`):

Run: `node node_modules/jest/bin/jest.js src/tracking/story-view-daily.spec.ts` → PASS.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add be/src/tracking/tracking.service.ts be/src/tracking/story-view-daily.spec.ts
git commit -m "feat(rankings): flush per-story daily view buckets"
```

---

### Task 3: `getTopStories` DTO + controller + counter metrics (reads/favorites/gifts)

**Files:**
- Create: `be/src/stats/dto/top-stories-query.dto.ts`
- Modify: `be/src/stats/stats.service.ts` (add `getTopStories` + `TopStoryMetric` enum + counter branch)
- Modify: `be/src/stats/stats.controller.ts` (add the route)
- Test: `be/src/stats/top-stories.spec.ts`

**Interfaces:**
- Produces: `enum TopStoryMetric { reads, rating, comments, favorites, gifts, trending, revenue, audio }`; `StatsService.getTopStories(query: TopStoriesQueryDto): Promise<{ data: Array<{ rank:number; storyId:string; title:string; slug:string; thumbnailUrl:string|null; value:number }> }>`. Route `GET /stats/top-stories`.

- [ ] **Step 1: Write the failing test** — `be/src/stats/top-stories.spec.ts` (counter-metric path; mock prisma):

```ts
import { StatsService, TopStoryMetric } from './stats.service';

function makeService(storyFindMany: jest.Mock) {
  const prisma: any = { story: { findMany: storyFindMany } };
  return new StatsService(prisma);
}

describe('getTopStories — counter metrics', () => {
  it('reads: orders by totalViews desc, excludes deleted, shapes rank/value', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'a', title: 'A', slug: 'a', thumbnailUrl: null, totalViews: 50n },
      { id: 'b', title: 'B', slug: 'b', thumbnailUrl: 't', totalViews: 10n },
    ]);
    const svc = makeService(findMany);
    const res = await svc.getTopStories({ metric: TopStoryMetric.reads, limit: 100 } as any);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null }),
      orderBy: { totalViews: 'desc' },
      take: 100,
    }));
    expect(res.data).toEqual([
      { rank: 1, storyId: 'a', title: 'A', slug: 'a', thumbnailUrl: null, value: 50 },
      { rank: 2, storyId: 'b', title: 'B', slug: 'b', thumbnailUrl: 't', value: 10 },
    ]);
  });
});
```
NOTE: match the real `StatsService` constructor when implementing — if it injects more than `PrismaService`, pass the extras as `{} as any` (only `prisma.story.findMany` is used here).

- [ ] **Step 2: Run → FAIL** (from `be/`):

Run: `node node_modules/jest/bin/jest.js src/stats/top-stories.spec.ts`
Expected: FAIL (export/method missing).

- [ ] **Step 3: Create the DTO** — `be/src/stats/dto/top-stories-query.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TopStoryMetric } from '../stats.service';

export class TopStoriesQueryDto {
  @IsEnum(TopStoryMetric)
  metric: TopStoryMetric;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 100;

  @IsOptional() @IsString()
  language?: string;
}
```

- [ ] **Step 4: Add the enum + method** to `be/src/stats/stats.service.ts`. Export the enum (top of file, after imports):

```ts
export enum TopStoryMetric {
  reads = 'reads',
  rating = 'rating',
  comments = 'comments',
  favorites = 'favorites',
  gifts = 'gifts',
  trending = 'trending',
  revenue = 'revenue',
  audio = 'audio',
}
```
Add the method (counter metrics now; the raw-SQL metrics are stubbed to `[]` here and filled in Task 4). `import { TopStoriesQueryDto } from './dto/top-stories-query.dto';` and ensure `Prisma` is imported from `@prisma/client`:

```ts
  async getTopStories(query: TopStoriesQueryDto) {
    const limit = Math.min(query.limit ?? 100, 100);
    const language = query.language?.trim();
    const langWhere = language ? { language: { key: language } } : {};

    const counterColumn: Partial<Record<TopStoryMetric, 'totalViews' | 'favoritesCount' | 'totalGifts'>> = {
      [TopStoryMetric.reads]: 'totalViews',
      [TopStoryMetric.favorites]: 'favoritesCount',
      [TopStoryMetric.gifts]: 'totalGifts',
    };

    const column = counterColumn[query.metric];
    if (column) {
      const stories = await this.prisma.story.findMany({
        where: { deletedAt: null, ...langWhere },
        orderBy: { [column]: 'desc' },
        take: limit,
        select: { id: true, title: true, slug: true, thumbnailUrl: true, [column]: true } as any,
      });
      return {
        data: stories.map((s: any, i: number) => ({
          rank: i + 1,
          storyId: s.id,
          title: s.title,
          slug: s.slug,
          thumbnailUrl: s.thumbnailUrl ?? null,
          value: Number(s[column] ?? 0),
        })),
      };
    }

    // Raw-SQL metrics (rating/comments/trending/revenue/audio) — implemented in Task 4.
    const ranked = await this.getTopStoriesAggregated(query.metric, limit, language);
    return { data: ranked };
  }

  // Placeholder replaced in Task 4.
  private async getTopStoriesAggregated(
    _metric: TopStoryMetric, _limit: number, _language?: string,
  ): Promise<Array<{ rank: number; storyId: string; title: string; slug: string; thumbnailUrl: string | null; value: number }>> {
    return [];
  }
```

- [ ] **Step 5: Add the controller route** to `be/src/stats/stats.controller.ts` (mirror `getVipChapterStats` guards; import `TopStoriesQueryDto`):

```ts
    @ApiOperation({ summary: 'Top truyện theo metric (admin)' })
    @Get('top-stories')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getTopStories(@Query() query: TopStoriesQueryDto) {
        return this.statsService.getTopStories(query);
    }
```

- [ ] **Step 6: Run test → PASS + typecheck** (from `be/`):

Run: `node node_modules/jest/bin/jest.js src/stats/top-stories.spec.ts` → PASS.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add be/src/stats/dto/top-stories-query.dto.ts be/src/stats/stats.service.ts be/src/stats/stats.controller.ts be/src/stats/top-stories.spec.ts
git commit -m "feat(rankings): top-stories endpoint + counter metrics"
```

---

### Task 4: Raw-SQL metrics — rating (Bayesian), comments, audio, revenue, trending

**Files:**
- Modify: `be/src/stats/stats.service.ts` (implement `getTopStoriesAggregated`)
- Test: `be/src/stats/top-stories.spec.ts` (add cases)

**Interfaces:**
- Consumes: `TopStoryMetric` (Task 3), `prisma.$queryRaw`, `Prisma.sql`/`Prisma.empty`, `story_view_daily` (Task 1).

- [ ] **Step 1: Add failing tests** to `be/src/stats/top-stories.spec.ts` (mock `$queryRaw` + the id→story hydration `findMany`):

```ts
describe('getTopStories — aggregated metrics', () => {
  it('comments: ranks by raw-SQL result, hydrates story info in SQL order', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      { id: 'x', value: 7n }, { id: 'y', value: 3n },
    ]);
    const findMany = jest.fn().mockResolvedValue([
      { id: 'y', title: 'Y', slug: 'y', thumbnailUrl: null },
      { id: 'x', title: 'X', slug: 'x', thumbnailUrl: 't' },
    ]);
    const prisma: any = { $queryRaw: queryRaw, story: { findMany } };
    const { StatsService, TopStoryMetric } = require('./stats.service');
    const svc = new StatsService(prisma);
    const res = await svc.getTopStories({ metric: TopStoryMetric.comments, limit: 100 });
    expect(res.data).toEqual([
      { rank: 1, storyId: 'x', title: 'X', slug: 'x', thumbnailUrl: 't', value: 7 },
      { rank: 2, storyId: 'y', title: 'Y', slug: 'y', thumbnailUrl: null, value: 3 },
    ]);
  });
});
```

- [ ] **Step 2: Run → FAIL** (aggregated returns `[]` → assertion fails). From `be/`:

Run: `node node_modules/jest/bin/jest.js src/stats/top-stories.spec.ts`
Expected: FAIL on the comments case.

- [ ] **Step 3: Implement `getTopStoriesAggregated`** (replace the Task-3 placeholder). Uses `$queryRaw` tagged templates with a `langFrag` conditional (via `Prisma.sql`/`Prisma.empty`), then hydrates story info preserving SQL order:

```ts
  private async getTopStoriesAggregated(
    metric: TopStoryMetric, limit: number, language?: string,
  ) {
    const langFrag = language
      ? Prisma.sql`AND s.language_id = (SELECT id FROM languages WHERE \`key\` = ${language})`
      : Prisma.empty;

    let rows: Array<{ id: string; value: any }> = [];

    if (metric === TopStoryMetric.comments) {
      rows = await this.prisma.$queryRaw<Array<{ id: string; value: bigint }>>`
        SELECT s.id AS id, COUNT(cc.id) AS value
        FROM stories s
        JOIN chapter_comments cc ON cc.story_id = s.id AND cc.is_hidden = 0
        WHERE s.deleted_at IS NULL ${langFrag}
        GROUP BY s.id
        ORDER BY value DESC
        LIMIT ${limit}`;
    } else if (metric === TopStoryMetric.audio) {
      rows = await this.prisma.$queryRaw<Array<{ id: string; value: bigint }>>`
        SELECT s.id AS id, COUNT(DISTINCT lh.user_id) AS value
        FROM stories s
        JOIN listening_history lh ON lh.story_id = s.id
        WHERE s.deleted_at IS NULL ${langFrag}
        GROUP BY s.id
        ORDER BY value DESC
        LIMIT ${limit}`;
    } else if (metric === TopStoryMetric.revenue) {
      rows = await this.prisma.$queryRaw<Array<{ id: string; value: any }>>`
        SELECT s.id AS id,
               (s.total_gifts + COALESCE(su.p, 0) + COALESCE(cu.p, 0)) AS value
        FROM stories s
        LEFT JOIN (SELECT story_id, SUM(pulse_amount) AS p FROM user_story_unlocks GROUP BY story_id) su
          ON su.story_id = s.id
        LEFT JOIN (SELECT c.story_id AS sid, SUM(u.pulse_amount) AS p
                   FROM user_chapter_unlocks u JOIN chapters c ON c.id = u.chapter_id
                   GROUP BY c.story_id) cu
          ON cu.sid = s.id
        WHERE s.deleted_at IS NULL ${langFrag}
        ORDER BY value DESC
        LIMIT ${limit}`;
    } else if (metric === TopStoryMetric.trending) {
      rows = await this.prisma.$queryRaw<Array<{ id: string; value: any }>>`
        SELECT s.id AS id,
               SUM(svd.views * POW(0.9, DATEDIFF(UTC_DATE(), svd.date))) AS value
        FROM stories s
        JOIN story_view_daily svd ON svd.story_id = s.id
        WHERE svd.date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY)
          AND s.deleted_at IS NULL ${langFrag}
        GROUP BY s.id
        ORDER BY value DESC
        LIMIT ${limit}`;
    } else if (metric === TopStoryMetric.rating) {
      const m = 10;
      rows = await this.prisma.$queryRaw<Array<{ id: string; value: any }>>`
        SELECT s.id AS id,
               ((s.rating_count / (s.rating_count + ${m})) * s.average_rating)
             + ((${m} / (s.rating_count + ${m})) *
                (SELECT AVG(average_rating) FROM stories WHERE rating_count > 0 AND deleted_at IS NULL)) AS value
        FROM stories s
        WHERE s.deleted_at IS NULL AND s.rating_count > 0 ${langFrag}
        ORDER BY value DESC
        LIMIT ${limit}`;
    }

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const stories = await this.prisma.story.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, slug: true, thumbnailUrl: true },
    });
    const byId = new Map(stories.map((s) => [s.id, s]));
    return rows.map((r, i) => {
      const s = byId.get(r.id);
      return {
        rank: i + 1,
        storyId: r.id,
        title: s?.title ?? '',
        slug: s?.slug ?? '',
        thumbnailUrl: s?.thumbnailUrl ?? null,
        value: Number(r.value ?? 0),
      };
    });
  }
```
(Ensure `import { Prisma } from '@prisma/client';` is present.)

- [ ] **Step 4: Run tests → PASS + typecheck** (from `be/`):

Run: `node node_modules/jest/bin/jest.js src/stats/top-stories.spec.ts` → PASS (counter + aggregated).
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add be/src/stats/stats.service.ts be/src/stats/top-stories.spec.ts
git commit -m "feat(rankings): raw-SQL metrics (rating/comments/audio/revenue/trending)"
```

---

### Task 5: Full verification

- [ ] **Step 1: Backend tests** (from `be/`): `node node_modules/jest/bin/jest.js src/stats src/tracking` → all PASS.
- [ ] **Step 2: Typecheck** (from `be/`): `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] **Step 3: Manual (BE up on 9001, admin token):** `GET /stats/top-stories?metric=reads&limit=5` → 200, ranked by views; try `metric=rating` (Bayesian, only rated stories), `metric=comments/audio/revenue` (aggregations), `metric=trending` (empty until the flush has run a few cycles — confirm no error). Bad `metric` → 400. Non-admin → 403.
- [ ] **Step 4: Commit** any fixups.

## Notes / follow-ups
- Prod needs `prisma migrate deploy` for `story_view_daily`.
- Trending is empty until the 5-min flush populates daily buckets (a few cycles) — expected.
- Live aggregation scans all stories for top-100; admin-only + infrequent, acceptable. Revisit with counters/materialized view if story count grows very large.
- **B2** adds the country dimension (IP→geoip in tracking + per-(story,country) rollups, reusing the `StoryViewDaily` daily-bucket pattern) + the deferred **search** metric. **C** builds the admin UI menus consuming `/stats/top-stories` (+ B2 endpoints).
