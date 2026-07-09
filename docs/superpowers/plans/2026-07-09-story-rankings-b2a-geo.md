# Story Rankings B2a (Anonymous Geo: view + search) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attribute anonymous story activity (views + a new "opened-from-search" event) to a country via event-time IP, store per-`(story, country, date, kind)`, and expose geo ranking endpoints (top-countries, per-country story ranking, top-5-countries-per-story) + the global `search` metric.

**Architecture:** A shared `resolveCountry(ip)`/`clientIp(req)` helper (mirrors auth's `geoip-lite` usage). `trackView` gains `@Req` → resolves country → increments a **country-namespaced** Redis counter (distinct prefix so it never collides with the existing view-counter flush); a new flush collector upserts these into a new `StoryCountryDaily` table. A new `POST /tracking/search-open` records search-opens the same way (dedup per device/hour), resolving slug-or-id → canonical story id. Stats endpoints aggregate `StoryCountryDaily`. Clients: web reuses its existing tracking helper; the app gets net-new tracking infra (deviceId + call) wired at the discover/search result taps.

**Tech Stack:** NestJS + Prisma (MySQL) + Redis (ioredis) + jest; `geoip-lite` (installed). Web = Next.js (axios `apiClient` + `getOrCreateDeviceId`). App = Flutter (`ApiClient` Dio + shared_preferences); `D:\SetupC\flutter\bin\flutter.bat`.

## Global Constraints

- **Backend repo:** `D:\SetupC\Projects\NovelApp\backend`, commands from `be/`. **App repo (separate git):** `D:\SetupC\Projects\NovelApp\novelverse`. On `master`, local commits only, do NOT push.
- **Country** = 2-letter ISO from `geoip.lookup(ip).country`, upper-case. Unresolvable IP (missing / localhost / private) → `null` → **skip** the geo bucket (no error; global counters unaffected).
- **IP extraction** (mirror auth verbatim): `const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress; const clientIp = ip ? ip.split(',')[0].trim() : undefined;`
- **geoip skip conditions** (mirror auth verbatim, incl. the imprecise `172.`): `isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost'`; `isPrivate = ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')`. Import: `import * as geoip from 'geoip-lite';`.
- **Redis geo prefix** = `story:geo:` — MUST be distinct from the existing `story:views:`/`chapter:views:` prefixes so the current flush's `scanKeys('story:views:*')` never matches geo keys. Geo key format: `story:geo:<kind>:<storyId>:<country>` (kind ∈ `view`|`search`).
- **Storage** table `story_country_daily`; global reads/trending stay on B1's `total_views`/`story_view_daily` (untouched).
- **Dedup:** view + search each 1 per device per hour per story (reuse the existing `redis.set(key,'1','EX',3600,'NX')` idiom; search dedup key `track:search:<storyId>:<deviceId>`).
- **Stats geo endpoints:** admin-guarded (`@UseGuards(JwtAccessGuard, RolesGuard) @Roles('ADMIN')`), raw SQL via `this.prisma.$queryRaw` tagged templates, BigInt→`Number(x ?? 0)`, exclude `stories.deleted_at IS NOT NULL` when hydrating.
- **search-open story id:** clients may send a slug (app) or UUID (web); the service resolves to the canonical `stories.id` before bucketing. `SearchOpenDto.storyId` is `@IsString` (NOT `@IsUUID`).
- **Migration `.sql` gitignored** → prod `migrate deploy`. If `migrate dev` hangs on shadow DB, apply SQL directly + `migrate resolve --applied` (as in B1/A).
- **Spec:** `docs/superpowers/specs/2026-07-09-story-rankings-b2a-geo-design.md`.

---

### Task 1: `resolveCountry` / `clientIp` geo helper

**Files:**
- Create: `be/src/common/geo/geo.util.ts`
- Test: `be/src/common/geo/geo.util.spec.ts`

**Interfaces:**
- Produces: `clientIp(req: { headers: any; socket?: { remoteAddress?: string } }): string | undefined`; `resolveCountry(ip?: string): string | null`.

- [ ] **Step 1: Write the failing test** — `be/src/common/geo/geo.util.spec.ts`:

```ts
import { clientIp, resolveCountry } from './geo.util';

jest.mock('geoip-lite', () => ({ lookup: jest.fn() }));
import * as geoip from 'geoip-lite';

describe('clientIp', () => {
  it('takes first x-forwarded-for entry', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } } as any)).toBe('1.2.3.4');
  });
  it('falls back to socket.remoteAddress', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '5.6.7.8' } } as any)).toBe('5.6.7.8');
  });
  it('undefined when none', () => {
    expect(clientIp({ headers: {} } as any)).toBeUndefined();
  });
});

describe('resolveCountry', () => {
  it('null for missing / localhost / private', () => {
    expect(resolveCountry(undefined)).toBeNull();
    expect(resolveCountry('127.0.0.1')).toBeNull();
    expect(resolveCountry('192.168.1.9')).toBeNull();
    expect(resolveCountry('10.0.0.5')).toBeNull();
  });
  it('returns upper 2-letter code from geoip', () => {
    (geoip.lookup as jest.Mock).mockReturnValue({ country: 'vn' });
    expect(resolveCountry('8.8.8.8')).toBe('VN');
  });
  it('null when geoip has no match', () => {
    (geoip.lookup as jest.Mock).mockReturnValue(null);
    expect(resolveCountry('8.8.8.8')).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL** (from `be/`): `node node_modules/jest/bin/jest.js src/common/geo/geo.util.spec.ts` → FAIL (module not found).

- [ ] **Step 3: Create the helper** — `be/src/common/geo/geo.util.ts`:

```ts
import * as geoip from 'geoip-lite';

export function clientIp(req: { headers: Record<string, any>; socket?: { remoteAddress?: string } }): string | undefined {
  const raw = (req.headers?.['x-forwarded-for'] as string) || req.socket?.remoteAddress;
  return raw ? String(raw).split(',')[0].trim() : undefined;
}

export function resolveCountry(ip?: string): string | null {
  if (!ip) return null;
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  const isPrivate = ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
  if (isLocalhost || isPrivate) return null;
  const geo = geoip.lookup(ip);
  return geo?.country ? geo.country.toUpperCase() : null;
}
```

- [ ] **Step 4: Run → PASS + typecheck** (from `be/`): `node node_modules/jest/bin/jest.js src/common/geo/geo.util.spec.ts` → PASS; `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Commit**
```bash
git add be/src/common/geo
git commit -m "feat(geo): resolveCountry + clientIp helper"
```

---

### Task 2: `StoryCountryDaily` table + migration

**Files:**
- Modify: `be/prisma/schema.prisma` (add model + `Story` back-relation)
- Migration: `be/prisma/migrations/<ts>_add_story_country_daily/`

**Interfaces:**
- Produces: `prisma.storyCountryDaily` with compound id `[storyId, country, date, kind]` (where-key `storyId_country_date_kind`).

- [ ] **Step 1: Add the model** to `be/prisma/schema.prisma` (near `StoryViewDaily`):
```prisma
model StoryCountryDaily {
  storyId String   @map("story_id") @db.VarChar(36)
  country String   @db.Char(2)
  date    DateTime @db.Date
  kind    String   @db.VarChar(10)
  count   Int      @default(0) @db.UnsignedInt

  story Story @relation(fields: [storyId], references: [id], onDelete: Cascade)

  @@id([storyId, country, date, kind])
  @@index([kind, country])
  @@index([kind, storyId])
  @@map("story_country_daily")
}
```
- [ ] **Step 2: Add the `Story` back-relation** (next to `storyViewDaily StoryViewDaily[]`): `storyCountryDaily StoryCountryDaily[]`.
- [ ] **Step 3: Apply migration** (from `be/`): `node node_modules/prisma/build/index.js migrate dev --name add_story_country_daily`. If it hangs on shadow DB: apply SQL directly (`CREATE TABLE story_country_daily (story_id VARCHAR(36) NOT NULL, country CHAR(2) NOT NULL, date DATE NOT NULL, kind VARCHAR(10) NOT NULL, count INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (story_id,country,date,kind), INDEX story_country_daily_kind_country_idx (kind,country), INDEX story_country_daily_kind_story_id_idx (kind,story_id), CONSTRAINT story_country_daily_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE ON UPDATE CASCADE) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`) then `migrate resolve --applied add_story_country_daily`.
- [ ] **Step 4: Generate + typecheck** (from `be/`): `node node_modules/prisma/build/index.js generate`; `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] **Step 5: Commit**
```bash
git add be/prisma/schema.prisma be/prisma/migrations
git commit -m "feat(geo): StoryCountryDaily table + migration"
```

---

### Task 3: View geo attribution (trackView IP → country counter → flush)

**Files:**
- Modify: `be/src/tracking/tracking.controller.ts` (trackView `@Req`), `be/src/tracking/tracking.service.ts` (helper + geo counter + geo flush collector)
- Test: `be/src/tracking/story-country-daily.spec.ts`

**Interfaces:**
- Consumes: `resolveCountry`/`clientIp` (T1), `prisma.storyCountryDaily` (T2).
- Produces: exported `buildStoryCountryUpsertArgs(storyId, country, kind, count, day)`; `TrackingService.trackView(dto, ip?)` (ip optional 2nd arg).

- [ ] **Step 1: Write the failing test** — `be/src/tracking/story-country-daily.spec.ts`:
```ts
import { buildStoryCountryUpsertArgs } from './tracking.service';

describe('buildStoryCountryUpsertArgs', () => {
  it('builds an upsert keyed on (storyId,country,date,kind) incrementing count', () => {
    const day = new Date('2026-07-09T00:00:00.000Z');
    expect(buildStoryCountryUpsertArgs('s1', 'VN', 'view', 3, day)).toEqual({
      where: { storyId_country_date_kind: { storyId: 's1', country: 'VN', date: day, kind: 'view' } },
      create: { storyId: 's1', country: 'VN', date: day, kind: 'view', count: 3 },
      update: { count: { increment: 3 } },
    });
  });
});
```
- [ ] **Step 2: Run → FAIL** (from `be/`): `node node_modules/jest/bin/jest.js src/tracking/story-country-daily.spec.ts`.
- [ ] **Step 3: Add the pure helper** near the top of `be/src/tracking/tracking.service.ts` (after imports; also `import { resolveCountry } from '@/common/geo/geo.util';`):
```ts
export function buildStoryCountryUpsertArgs(storyId: string, country: string, kind: string, count: number, day: Date) {
  return {
    where: { storyId_country_date_kind: { storyId, country, date: day, kind } },
    create: { storyId, country, date: day, kind, count },
    update: { count: { increment: count } },
  };
}
```
- [ ] **Step 4: Add a geo Redis prefix + resolve/increment on counted view.** Add field `private readonly STORY_GEO_PREFIX = 'story:geo:';`. Change `trackView(dto)` → `trackView(dto: TrackEventDto, ip?: string)`; pass `ip` into `track('view', dto, ip)`. In `track(kind, dto, ip?)`, after the existing dedup passes and the existing `story:views:`/`chapter:views:` incr, add:
```ts
    const country = resolveCountry(ip);
    if (country) {
      await this.redis.incr(`${this.STORY_GEO_PREFIX}${kind}:${dto.storyId}:${country}`);
    }
```
(Leave the existing global counters + dedup exactly as-is.)
- [ ] **Step 5: Controller `@Req`.** In `tracking.controller.ts`, add `@Req()` (import `Req` from `@nestjs/common`, `Request` from `express`) + `clientIp`:
```ts
  @Post('view')
  trackView(@Body() dto: TrackEventDto, @Req() req: Request) {
    return this.trackingService.trackView(dto, clientIp(req));
  }
```
(`import { clientIp } from '@/common/geo/geo.util';`)
- [ ] **Step 6: Add a geo flush collector.** In `flushTrackingCounters`, after the existing story/chapter `collectByPrefix` calls, add a scan+flush for geo keys (parse `kind:storyId:country`, RENAME→processing→GET count like the existing collector, push `storyCountryDaily.upsert(buildStoryCountryUpsertArgs(storyId, country, kind, count, today))` into the SAME `writes[]` before `$transaction`). Reuse `today` from the B1 daily-bucket block. Concretely add after the chapter collect:
```ts
      const geoKeys = await this.scanKeys(`${this.STORY_GEO_PREFIX}*`);
      for (const key of geoKeys) {
        const rest = key.slice(this.STORY_GEO_PREFIX.length); // "<kind>:<storyId>:<country>"
        const [kind, storyId, country] = rest.split(':');
        if (!kind || !storyId || !country) continue;
        const processingKey = `${key}:processing:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        try { await this.redis.rename(key, processingKey); } catch { continue; }
        const countStr = await this.redis.get(processingKey);
        const count = Number.parseInt(countStr || '0', 10);
        if (!Number.isFinite(count) || count <= 0) { await this.redis.del(processingKey); continue; }
        processingEntries.push({ originalKey: key, processingKey, count });
        writes.push(this.prisma.storyCountryDaily.upsert(buildStoryCountryUpsertArgs(storyId, country, kind, count, today)));
      }
```
(This mirrors the existing collector's atomic-swap + restore semantics — the pushed upserts ride the same `$transaction(writes)` and its restore-on-failure loop over `processingEntries`.)
- [ ] **Step 7: Run test + typecheck** (from `be/`): `node node_modules/jest/bin/jest.js src/tracking` → PASS; `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] **Step 8: Commit**
```bash
git add be/src/tracking be/src/common/geo
git commit -m "feat(geo): attribute views to country + flush StoryCountryDaily"
```

---

### Task 4: `POST /tracking/search-open` event

**Files:**
- Create: `be/src/tracking/dto/search-open.dto.ts`
- Modify: `be/src/tracking/tracking.controller.ts` (route), `be/src/tracking/tracking.service.ts` (trackSearchOpen)
- Test: `be/src/tracking/search-open.spec.ts`

**Interfaces:**
- Produces: `TrackingService.trackSearchOpen(dto: SearchOpenDto, ip?: string)`; route `POST /tracking/search-open`.

- [ ] **Step 1: Write the failing test** — `be/src/tracking/search-open.spec.ts` (verifies dedup + slug/id resolution + geo incr; mock redis + prisma):
```ts
import { TrackingService } from './tracking.service';
jest.mock('@/common/geo/geo.util', () => ({ resolveCountry: () => 'VN', clientIp: () => '8.8.8.8' }));

function makeService() {
  const redis: any = { set: jest.fn().mockResolvedValue('OK'), incr: jest.fn().mockResolvedValue(1) };
  const prisma: any = { story: { findFirst: jest.fn().mockResolvedValue({ id: 'real-id' }) } };
  const svc: any = new TrackingService(prisma, { get: () => 'redis://x' } as any);
  svc.redis = redis; svc.redisEnabled = true;
  return { svc, redis, prisma };
}

describe('trackSearchOpen', () => {
  it('resolves slug->id, dedups, increments geo search counter', async () => {
    const { svc, redis, prisma } = makeService();
    await svc.trackSearchOpen({ storyId: 'my-slug', deviceId: 'device-123456' }, '8.8.8.8');
    expect(prisma.story.findFirst).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith('track:search:real-id:device-123456', '1', 'EX', 3600, 'NX');
    expect(redis.incr).toHaveBeenCalledWith('story:geo:search:real-id:VN');
  });
});
```
(Adjust the `new TrackingService(...)` args to the real constructor — it's `(prisma, configService)`; the constructor early-returns without a real REDIS_URL, so we set `svc.redis`/`svc.redisEnabled` after construction. If construction touches Redis, pass a config stub returning a URL and immediately overwrite `svc.redis` with the mock as shown.)

- [ ] **Step 2: Run → FAIL** (from `be/`): `node node_modules/jest/bin/jest.js src/tracking/search-open.spec.ts`.
- [ ] **Step 3: Create the DTO** — `be/src/tracking/dto/search-open.dto.ts`:
```ts
import { IsString, Length } from 'class-validator';

export class SearchOpenDto {
  @IsString()
  storyId: string; // slug OR uuid — resolved server-side

  @IsString()
  @Length(8, 128)
  deviceId: string;
}
```
- [ ] **Step 4: Add `trackSearchOpen`** to `TrackingService`:
```ts
  async trackSearchOpen(dto: SearchOpenDto, ip?: string) {
    this.ensureRedisEnabled();
    const story = await this.prisma.story.findFirst({
      where: { OR: [{ id: dto.storyId }, { slug: dto.storyId }], deletedAt: null },
      select: { id: true },
    });
    if (!story) return { counted: false, notFound: true };

    const dedupKey = `track:search:${story.id}:${dto.deviceId}`;
    const created = await this.redis.set(dedupKey, '1', 'EX', this.DEDUP_TTL_SECONDS, 'NX');
    if (!created) return { counted: false, deduplicated: true };

    const country = resolveCountry(ip);
    if (country) {
      await this.redis.incr(`${this.STORY_GEO_PREFIX}search:${story.id}:${country}`);
    }
    return { counted: true };
  }
```
(`import { SearchOpenDto } from './dto/search-open.dto';`)
- [ ] **Step 5: Add the controller route** to `tracking.controller.ts`:
```ts
  @ApiOperation({ summary: 'Ghi nhận mở truyện từ tìm kiếm' })
  @Post('search-open')
  trackSearchOpen(@Body() dto: SearchOpenDto, @Req() req: Request) {
    return this.trackingService.trackSearchOpen(dto, clientIp(req));
  }
```
- [ ] **Step 6: Run test + typecheck** (from `be/`) → PASS; tsc exit 0.
- [ ] **Step 7: Commit**
```bash
git add be/src/tracking
git commit -m "feat(geo): POST /tracking/search-open event"
```

---

### Task 5: Stats geo ranking endpoints + global search metric

**Files:**
- Create: `be/src/stats/dto/top-countries-query.dto.ts`, `stories-by-country-query.dto.ts`, `story-top-countries-query.dto.ts`
- Modify: `be/src/stats/stats.service.ts` (3 new methods + `search` metric in `getTopStoriesAggregated` + `TopStoryMetric.search`), `be/src/stats/stats.controller.ts` (3 routes)
- Test: `be/src/stats/geo-rankings.spec.ts`

**Interfaces:**
- Consumes: `story_country_daily` (T2). Metric-kind enum for geo = `'view' | 'search'`.
- Produces: `GET /stats/top-countries`, `/stats/top-stories-by-country`, `/stats/story-top-countries`; `TopStoryMetric.search`.

- [ ] **Step 1: Write failing tests** — `be/src/stats/geo-rankings.spec.ts` (mock `$queryRaw` + hydration `findMany`; assert shape + order for `getTopCountries`, `getTopStoriesByCountry`, `getStoryTopCountries`). Follow the B1 `top-stories.spec.ts` mocking style (rows `[{...}]` from `$queryRaw`, `story.findMany` for hydration, assert `{rank,...}` output preserves SQL order).
```ts
import { StatsService } from './stats.service';
describe('geo rankings', () => {
  it('getTopCountries returns ranked {country,value}', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 9n }, { country: 'US', value: 4n }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    const res = await svc.getTopCountries({ metric: 'view', limit: 20 });
    expect(res.data).toEqual([{ rank: 1, country: 'VN', value: 9 }, { rank: 2, country: 'US', value: 4 }]);
  });
});
```
- [ ] **Step 2: Run → FAIL** (from `be/`): `node node_modules/jest/bin/jest.js src/stats/geo-rankings.spec.ts`.
- [ ] **Step 3: Add DTOs.** `top-countries-query.dto.ts`: `metric` `@IsIn(['view','search'])`, `limit?` `@IsInt @Min(1) @Max(100)` default 20. `stories-by-country-query.dto.ts`: `country` `@IsString @Length(2,2)`, `metric` `@IsIn(['view','search'])`, `limit?` default 100. `story-top-countries-query.dto.ts`: `storyId` `@IsString`, `metric?` `@IsIn(['view','search'])` default `'view'`, `limit?` default 5. (Use `@Type(() => Number)` on numeric fields.)
- [ ] **Step 4: Add service methods** to `StatsService` (raw SQL, `Number(...)` on bigint):
```ts
  async getTopCountries(q: { metric: string; limit?: number }) {
    const limit = Math.min(q.limit ?? 20, 100);
    const rows = await this.prisma.$queryRaw<Array<{ country: string; value: bigint }>>`
      SELECT country, SUM(count) AS value FROM story_country_daily
      WHERE kind = ${q.metric} GROUP BY country ORDER BY value DESC LIMIT ${limit}`;
    return { data: rows.map((r, i) => ({ rank: i + 1, country: r.country, value: Number(r.value ?? 0) })) };
  }

  async getTopStoriesByCountry(q: { country: string; metric: string; limit?: number }) {
    const limit = Math.min(q.limit ?? 100, 100);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; value: bigint }>>`
      SELECT scd.story_id AS id, SUM(scd.count) AS value
      FROM story_country_daily scd JOIN stories s ON s.id = scd.story_id
      WHERE scd.kind = ${q.metric} AND scd.country = ${q.country} AND s.deleted_at IS NULL
      GROUP BY scd.story_id ORDER BY value DESC LIMIT ${limit}`;
    if (!rows.length) return { data: [] };
    const stories = await this.prisma.story.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: { id: true, title: true, slug: true, thumbnailUrl: true } });
    const byId = new Map(stories.map((s) => [s.id, s]));
    return { data: rows.map((r, i) => { const s = byId.get(r.id); return { rank: i + 1, storyId: r.id, title: s?.title ?? '', slug: s?.slug ?? '', thumbnailUrl: s?.thumbnailUrl ?? null, value: Number(r.value ?? 0) }; }) };
  }

  async getStoryTopCountries(q: { storyId: string; metric?: string; limit?: number }) {
    const limit = Math.min(q.limit ?? 5, 50);
    const kind = q.metric ?? 'view';
    const rows = await this.prisma.$queryRaw<Array<{ country: string; value: bigint }>>`
      SELECT country, SUM(count) AS value FROM story_country_daily
      WHERE story_id = ${q.storyId} AND kind = ${kind} GROUP BY country ORDER BY value DESC LIMIT ${limit}`;
    return { data: rows.map((r) => ({ country: r.country, value: Number(r.value ?? 0) })) };
  }
```
- [ ] **Step 5: Add `search` global metric.** Add `search = 'search'` to `TopStoryMetric`; add a branch in `getTopStoriesAggregated`:
```ts
    } else if (metric === TopStoryMetric.search) {
      rows = await this.prisma.$queryRaw<Array<{ id: string; value: bigint }>>`
        SELECT s.id AS id, SUM(scd.count) AS value
        FROM stories s JOIN story_country_daily scd ON scd.story_id = s.id AND scd.kind = 'search'
        WHERE s.deleted_at IS NULL ${langFrag}
        GROUP BY s.id ORDER BY value DESC LIMIT ${limit}`;
    }
```
- [ ] **Step 6: Add controller routes** (`stats.controller.ts`, admin-guarded, mirror `getTopStories`): `@Get('top-countries')`, `@Get('top-stories-by-country')`, `@Get('story-top-countries')` → the 3 service methods with their DTOs.
- [ ] **Step 7: Run tests + typecheck** (from `be/`): `node node_modules/jest/bin/jest.js src/stats` → PASS; tsc exit 0.
- [ ] **Step 8: Commit**
```bash
git add be/src/stats
git commit -m "feat(geo): top-countries / stories-by-country / story-top-countries + search metric"
```

---

### Task 6: Web — emit search-open on result click

**Files (repo `D:\SetupC\Projects\NovelApp\backend`, web `fe/apps/web`):**
- Modify: the search results page `fe/apps/web/src/app/[lang]/(main)/search/page.tsx` (fire tracking on result open)

**Interfaces:**
- Consumes: `POST /tracking/search-open { storyId, deviceId }` (T4); reuse `getOrCreateDeviceId` (`@/lib/tracking/device-id`) + `apiClient` (`@/lib/api/api-client`).

- [ ] **Step 1: Wire a fire-and-forget search-open call.** In `search/page.tsx`, wrap each result's `<StoryCard story={story} />` in an element with an `onClick` (capture-phase, before Next navigation) that fires the call; e.g. `<div key={story.id} onClick={() => { const d = getOrCreateDeviceId(); if (d) void apiClient.post('/tracking/search-open', { storyId: story.id, deviceId: d }).catch(() => {}); }}>` around the `<StoryCard>`. Import `getOrCreateDeviceId` + `apiClient`. Send `story.id` (the web story object's id — the canonical id; backend also accepts slug). Do NOT block navigation.
- [ ] **Step 2: Typecheck** (from `fe/apps/web`): `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → no new errors.
- [ ] **Step 3: Commit**
```bash
git add "fe/apps/web/src/app/[lang]/(main)/search/page.tsx"
git commit -m "feat(geo): web emits search-open on search result click"
```

---

### Task 7: App (Flutter) — search-open tracking (net-new)

**Files (repo `D:\SetupC\Projects\NovelApp\novelverse`):**
- Modify: `lib/api/api_endpoints.dart` (add `trackSearchOpen` path); `lib/data/repositories/stories_repository.dart` (add `trackSearchOpen` method); `lib/screens/novel/discover_screen.dart` (call at the 2 result-tap sites); a deviceId source (new `lib/data/device_id.dart` using shared_preferences)
- Test: `test/data/device_id_test.dart` (deviceId persistence) if feasible

**Interfaces:**
- Consumes: `POST /tracking/search-open { storyId, deviceId }` (T4). App sends `Book.id` (a **slug**) — backend resolves.

- [ ] **Step 1: deviceId source.** Create `lib/data/device_id.dart`: `Future<String> getOrCreateDeviceId()` using `shared_preferences` key `wta_device_id` — read existing, else generate (e.g. a UUID-ish string; reuse any existing uuid dep or `DateTime.now().microsecondsSinceEpoch` + random) and persist. (Match how ReaderStore uses SharedPreferences.)
- [ ] **Step 2: Endpoint + repo method.** Add `static const trackSearchOpen = '/tracking/search-open';` to `ApiEndpoints`. In `StoriesRepository` add:
```dart
  Future<void> trackSearchOpen(String storyId, String deviceId) async {
    try {
      await _api.post(ApiEndpoints.trackSearchOpen, body: {'storyId': storyId, 'deviceId': deviceId});
    } catch (_) { /* fire-and-forget */ }
  }
```
- [ ] **Step 3: Wire at the 2 discover search-result taps.** In `discover_screen.dart` `_resultRow` and `_featureImage`, before/alongside `context.push('/book/${b.id}')`, fire `getOrCreateDeviceId().then((d) => repo.trackSearchOpen(b.id, d))` (obtain the `StoriesRepository`/api the screen already uses; do not block navigation). Only fire when the list is showing SEARCH results (guard by the screen's search-active state — the taps live in the search results path).
- [ ] **Step 4: Verify** (from `novelverse`): `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 new errors/warnings; if a device_id test was added, `"/d/SetupC/flutter/bin/flutter.bat" test test/data/device_id_test.dart` → PASS.
- [ ] **Step 5: Commit** (in `novelverse`)
```bash
git add lib/api/api_endpoints.dart lib/data/repositories/stories_repository.dart lib/screens/novel/discover_screen.dart lib/data/device_id.dart test/data/device_id_test.dart
git commit -m "feat(geo): app emits search-open when opening a story from search"
```

---

### Task 8: Full verification

- [ ] **Step 1: Backend** (from `be/`): `node node_modules/jest/bin/jest.js src/common/geo src/tracking src/stats` → all PASS; `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] **Step 2: Web** (from `fe/apps/web`): typecheck clean.
- [ ] **Step 3: App** (from `novelverse`): `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 error/warning; `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS.
- [ ] **Step 4: Live SQL smoke** (BE up, dev DB): run the 3 geo queries + the search-global query via mysql (`SELECT country, SUM(count) FROM story_country_daily WHERE kind='view' GROUP BY country ORDER BY 2 DESC LIMIT 20;` etc.) → execute without error (empty until traffic).
- [ ] **Step 5: Manual (optional):** hit `POST /tracking/search-open {storyId:<slug>,deviceId:...}` → 200; `GET /stats/top-countries?metric=view` (admin) → 200.
- [ ] **Step 6: Commit** any fixups.

## Notes / follow-ups
- Prod `migrate deploy` for `story_country_daily`.
- **B2b**: event-time IP on favorite/comment/rating/gift/unlock/listen → per-country for the 6 user-action metrics.
- **C**: admin UI (Top Countries, per-country ranking, top-5-countries column via `/stats/story-top-countries`).
- Follow-ups: refactor auth to use `resolveCountry`; set Express `trust proxy` in prod (XFF spoofable otherwise); geoip-lite DB update job.
