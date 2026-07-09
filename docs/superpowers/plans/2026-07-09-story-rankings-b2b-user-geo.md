# Story Rankings B2b (User-action Geo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attribute 6 user actions (favorite, comment, rating, gift, revenue-unlock, listen) to a country via event-time IP, recording per-`(story, country, date, kind)` buckets in the existing `StoryCountryDaily` table, so all 6 metrics gain per-country rankings.

**Architecture:** A shared injectable `GeoService.record(storyId, ip, kind, value=1)` (resolves country via the B2a `resolveCountry` helper, upserts `StoryCountryDaily`, fire-and-forget) is called at each action's real write site — *after* the main write succeeds, outside money transactions. Controllers that lack `@Req` get it added; the IP is threaded to the service. The 3 geo stats endpoints' `metric` param is widened to accept the 6 new kinds. No migration (`kind` is a string; `StoryCountryDaily` exists from B2a).

**Tech Stack:** NestJS + Prisma (MySQL) + jest (`node node_modules/jest/bin/jest.js` from `be/`). Reuses `be/src/common/geo/geo.util.ts` (`resolveCountry`, `clientIp`) from B2a.

## Global Constraints

- **Repo:** `D:\SetupC\Projects\NovelApp\backend`, commands from `be/`. On `master`, local commits only, do NOT push.
- **kinds** (StoryCountryDaily.kind, VARCHAR(10) — no migration): existing `view`,`search`; new `favorite`,`comment`,`rating`,`gift`,`revenue`,`listen`.
- **Values:** favorite/comment/rating/listen = `1`; gift = the gifted Pulse `numericAmount`; revenue = the paid `finalPrice` Pulse.
- **`GeoService.record` is fire-and-forget:** wrapped in try/catch, returns void, MUST NOT block or roll back the host action. Call as `void this.geo.record(...)` (do not `await` in a way that can fail the request) OR `await` inside its own try/catch — either way a geo failure never propagates.
- **Placement:** call `record` at the EXACT real write site, on the success path only — respecting early-returns/idempotent skips (already-unlocked → no record; favorite remove → no record; free VIP/AD unlock → no record).
- **IP:** `clientIp(req)` from `@/common/geo/geo.util`; add `@Req() req: Request` (`express` Request) to handlers lacking it (keep the existing `@Account()`); the 2 chapter-unlock handlers already have `@Req`.
- **storyId at write site:** favorite/gift/unlock-story = the route/DTO id directly; comment/unlock-chapter = `chapter.storyId` (already fetched); rating = the `resolveStoryId(...)` result (slug-or-id → canonical id) already computed in `upsertReview`.
- **Wiring-task verification:** these are integration wirings; verify via `tsc --noEmit` (compiles) + the module's existing tests still pass + correct write-site placement (reviewer checks). `GeoService` itself (Task 1) is fully unit-tested. Where a service is cheaply instantiable, add a focused test asserting `geo.record` is called on the right branch.
- **Spec:** `docs/superpowers/specs/2026-07-09-story-rankings-b2b-user-geo-design.md`.

---

### Task 1: `GeoService` + `GeoModule`

**Files:**
- Create: `be/src/common/geo/geo.service.ts`, `be/src/common/geo/geo.module.ts`
- Test: `be/src/common/geo/geo.service.spec.ts`

**Interfaces:**
- Consumes: `resolveCountry` (`be/src/common/geo/geo.util.ts`, B2a); `PrismaService`; `prisma.storyCountryDaily` (compound key `storyId_country_date_kind`, B2a).
- Produces: `GeoService.record(storyId: string, ip: string | undefined, kind: string, value = 1): Promise<void>`; `GeoModule` (exports `GeoService`).

- [ ] **Step 1: Write the failing test** — `be/src/common/geo/geo.service.spec.ts`:
```ts
jest.mock('./geo.util', () => ({ resolveCountry: (ip?: string) => (ip === '8.8.8.8' ? 'VN' : null) }));
import { GeoService } from './geo.service';

function make() { const upsert = jest.fn(); return { svc: new GeoService({ storyCountryDaily: { upsert } } as any), upsert }; }

describe('GeoService.record', () => {
  it('upserts increment when country resolves', async () => {
    const { svc, upsert } = make();
    await svc.record('s1', '8.8.8.8', 'favorite', 1);
    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0][0];
    expect(args.where.storyId_country_date_kind).toMatchObject({ storyId: 's1', country: 'VN', kind: 'favorite' });
    expect(args.create).toMatchObject({ storyId: 's1', country: 'VN', kind: 'favorite', count: 1 });
    expect(args.update).toEqual({ count: { increment: 1 } });
  });
  it('no-op when country unresolvable', async () => {
    const { svc, upsert } = make();
    await svc.record('s1', '127.0.0.1', 'favorite', 1);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('no-op when value <= 0', async () => {
    const { svc, upsert } = make();
    await svc.record('s1', '8.8.8.8', 'gift', 0);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('swallows upsert errors (fire-and-forget)', async () => {
    const upsert = jest.fn().mockRejectedValue(new Error('db down'));
    const svc = new GeoService({ storyCountryDaily: { upsert } } as any);
    await expect(svc.record('s1', '8.8.8.8', 'gift', 5)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → FAIL** (from `be/`): `node node_modules/jest/bin/jest.js src/common/geo/geo.service.spec.ts`.

- [ ] **Step 3: Create `geo.service.ts`:**
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveCountry } from './geo.util';

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Record a per-(story,country,day,kind) activity bucket. Fire-and-forget: never throws, never blocks the host action. */
  async record(storyId: string, ip: string | undefined, kind: string, value = 1): Promise<void> {
    try {
      if (value <= 0) return;
      const country = resolveCountry(ip);
      if (!country) return;
      const day = new Date();
      day.setUTCHours(0, 0, 0, 0);
      await this.prisma.storyCountryDaily.upsert({
        where: { storyId_country_date_kind: { storyId, country, date: day, kind } },
        create: { storyId, country, date: day, kind, count: value },
        update: { count: { increment: value } },
      });
    } catch {
      /* geo is non-critical: swallow so the host action is unaffected */
    }
  }
}
```

- [ ] **Step 4: Create `geo.module.ts`:**
```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { GeoService } from './geo.service';

@Module({ imports: [PrismaModule], providers: [GeoService], exports: [GeoService] })
export class GeoModule {}
```
(If `PrismaModule` is `@Global()`, importing it is harmless; keep it for parity with `tracking.module.ts`.)

- [ ] **Step 5: Run → PASS + typecheck** (from `be/`): jest spec PASS (4 tests); `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 6: Commit**
```bash
git add be/src/common/geo/geo.service.ts be/src/common/geo/geo.module.ts be/src/common/geo/geo.service.spec.ts
git commit -m "feat(geo): shared GeoService.record for per-country activity buckets"
```

---

### Task 2: Favorite + Listen geo (user-features)

**Files:**
- Modify: `be/src/user-features/user-features.controller.ts` (`@Req` on `toggleFavorite` + `syncHistory`), `be/src/user-features/user-features.service.ts` (ip param + `geo.record`), `be/src/user-features/user-features.module.ts` (import `GeoModule`, inject `GeoService`)

**Interfaces:**
- Consumes: `GeoService` (Task 1), `clientIp` (`@/common/geo/geo.util`).

- [ ] **Step 1: Import + inject.** In `user-features.module.ts` add `GeoModule` to `imports`. In `UserFeaturesService` constructor, inject `private readonly geo: GeoService` (`import { GeoService } from '@/common/geo/geo.service'`).

- [ ] **Step 2: FAVORITE — controller.** In `user-features.controller.ts` `toggleFavorite` handler (POST `favorites/toggle`), add `@Req() req: Request` (import `Req` from `@nestjs/common`, `Request` from `express`), and pass `clientIp(req)` into the service call: `toggleFavorite(userId, dto.storyId, clientIp(req))`.

- [ ] **Step 3: FAVORITE — service.** `UserFeaturesService.toggleFavorite(userId, storyId, ip?: string)`: in the **ADD branch only** (after `prisma.userFavorite.create(...)` + the `favoritesCount` increment, ~line 225-232), add:
```ts
      void this.geo.record(storyId, ip, 'favorite', 1);
```
Do NOT add anything in the remove/toggle-off branch.

- [ ] **Step 4: LISTEN — controller.** In `syncHistory` handler (POST `history/sync`), add `@Req() req: Request`, pass `clientIp(req)`: `syncHistory(userId, dto, clientIp(req))`.

- [ ] **Step 5: LISTEN — service.** `UserFeaturesService.syncHistory(userId, dto, ip?: string)`: record the geo bucket **synchronously at request time** (NOT tied to the Redis/cron persistence path) — near the top of the method, once per call:
```ts
      void this.geo.record(dto.storyId, ip, 'listen', 1);
```
(Place it before the Redis-vs-DB branching so it fires regardless of persistence path.)

- [ ] **Step 6: Verify** (from `be/`): `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0; `node node_modules/jest/bin/jest.js src/user-features` → existing tests still PASS (if any).

- [ ] **Step 7: Commit**
```bash
git add be/src/user-features
git commit -m "feat(geo): country buckets for favorite + listen"
```

---

### Task 3: Comment geo (chapter-comments)

**Files:**
- Modify: `be/src/chapter-comments/chapter-comments.controller.ts` (`@Req`), `chapter-comments.service.ts` (ip param + record), `chapter-comments.module.ts` (GeoModule)

- [ ] **Step 1: Import + inject** `GeoModule` (module) + `GeoService` (service constructor).
- [ ] **Step 2: Controller** `create` handler (POST `chapters/:chapterId/comments`): add `@Req() req: Request`, pass `clientIp(req)` → `create(userId, chapterId, dto, clientIp(req))`.
- [ ] **Step 3: Service** `ChapterCommentsService.create(userId, chapterId, dto, ip?: string)`: after the `chapterComment.create({...})` (~line 259-282) succeeds, add `void this.geo.record(chapter.storyId, ip, 'comment', 1);` (`chapter.storyId` is already in scope from the chapter lookup at the top of the method).
- [ ] **Step 4: Verify** (from `be/`): tsc exit 0; `node node_modules/jest/bin/jest.js src/chapter-comments` existing tests PASS.
- [ ] **Step 5: Commit**
```bash
git add be/src/chapter-comments
git commit -m "feat(geo): country bucket for comments"
```

---

### Task 4: Rating geo (reviews)

**Files:**
- Modify: `be/src/reviews/reviews.controller.ts` (`@Req`), `reviews.service.ts` (ip param + record), `reviews.module.ts` (GeoModule)

- [ ] **Step 1: Import + inject** `GeoModule` + `GeoService`.
- [ ] **Step 2: Controller** `upsertReview` handler (POST `stories/:storyId/reviews`): add `@Req() req: Request`, pass `clientIp(req)` → `upsertReview(storyId, userId, dto, clientIp(req))`.
- [ ] **Step 3: Service** `ReviewsService.upsertReview(storyIdOrSlug, userId, dto, ip?: string)`: `resolveStoryId(...)` already yields the canonical `storyId` (~line 204). After the `review.upsert({...})` (~line 210-236) succeeds, add `void this.geo.record(storyId, ip, 'rating', 1);` (count each upsert — create or update).
- [ ] **Step 4: Verify** (from `be/`): tsc exit 0; `node node_modules/jest/bin/jest.js src/reviews` existing tests PASS.
- [ ] **Step 5: Commit**
```bash
git add be/src/reviews
git commit -m "feat(geo): country bucket for ratings"
```

---

### Task 5: Gift + Unlock-story geo (stories)

**Files:**
- Modify: `be/src/stories/stories.controller.ts` (`@Req` on `giftPulse` + `unlockStory`), `stories.service.ts` (ip params + record), `stories.module.ts` (GeoModule)

- [ ] **Step 1: Import + inject** `GeoModule` (stories.module) + `GeoService` (StoriesService constructor).
- [ ] **Step 2: GIFT — controller** `giftPulse` (POST `stories/:id/gift`): add `@Req() req: Request`; pass `clientIp(req)` → `giftPulse(id, userId, amount, message, chapterId, clientIp(req))` (append `ip` as the last param).
- [ ] **Step 3: GIFT — service** `giftPulse(storyId, userId, amount, message?, chapterId?, ip?: string)`: AFTER the `await this.prisma.$transaction([...])` (array form, ~line 1179-1202) resolves successfully, add `void this.geo.record(storyId, ip, 'gift', numericAmount);` (`numericAmount` is the validated Pulse amount; `storyId` is the `:id` param).
- [ ] **Step 4: UNLOCK-STORY — controller** `unlockStory` (POST `stories/:id/unlock`): add `@Req() req: Request`; pass `clientIp(req)` → `unlockStoryByPulse(id, userId, clientIp(req))`.
- [ ] **Step 5: UNLOCK-STORY — service** `unlockStoryByPulse(storyId, userId, ip?: string)`: there's an early-return when already unlocked (~line 938-940) — do NOT record there. AFTER the `$transaction(async (tx) => {...})` (~line 955-983) resolves on the create path, add `void this.geo.record(storyId, ip, 'revenue', finalPrice);` (`finalPrice` = the computed paid Pulse).
- [ ] **Step 6: Verify** (from `be/`): tsc exit 0; `node node_modules/jest/bin/jest.js src/stories` existing tests PASS.
- [ ] **Step 7: Commit**
```bash
git add be/src/stories
git commit -m "feat(geo): country buckets for gift + story unlock revenue"
```

---

### Task 6: Unlock-chapter-by-pulse geo (chapters)

**Files:**
- Modify: `be/src/chapters/chapters.controller.ts` (already has `@Req` — reuse), `chapters.service.ts` (ip param + record), `chapters.module.ts` (GeoModule)

- [ ] **Step 1: Import + inject** `GeoModule` (chapters.module) + `GeoService` (ChaptersService constructor).
- [ ] **Step 2: Controller** `unlockByPulse` (POST `chapters/:id/unlock-by-pulse`) ALREADY has `@Req() req: Request` — pass `clientIp(req)` into the service: `unlockByPulse(id, userId, clientIp(req))`.
- [ ] **Step 3: Service** `ChaptersService.unlockByPulse(chapterId, userId, ip?: string)`: only the **paid PULSE branch** inside the `$transaction(async (tx) => {...})` (~line 504-535) is real revenue (VIP/AD/timed/already-unlocked paths return early or write `pulseAmount: 0` — do NOT record for those). AFTER the paid `$transaction` resolves, add `void this.geo.record(chapter.storyId, ip, 'revenue', finalPrice);` (`chapter.storyId` is already selected at the top ~line 383-394; `finalPrice` = paid Pulse). Do NOT touch `unlockByAd`.
- [ ] **Step 4: Verify** (from `be/`): tsc exit 0; `node node_modules/jest/bin/jest.js src/chapters` existing tests PASS.
- [ ] **Step 5: Commit**
```bash
git add be/src/chapters
git commit -m "feat(geo): country bucket for chapter unlock revenue"
```

---

### Task 7: Widen geo stats `metric` to the 6 new kinds

**Files:**
- Modify: `be/src/stats/dto/top-countries-query.dto.ts`, `stories-by-country-query.dto.ts`, `story-top-countries-query.dto.ts`
- Test: `be/src/stats/geo-rankings.spec.ts` (add a case)

**Interfaces:**
- The 3 geo endpoints already `GROUP BY kind` = the `metric` param (B2a); only the DTO validation whitelist changes.

- [ ] **Step 1: Add a failing test** to `be/src/stats/geo-rankings.spec.ts` asserting a new kind flows through (e.g. `getTopCountries({ metric: 'favorite', limit: 20 })` calls `$queryRaw` and returns shaped rows — mirror the existing `view` test with `metric:'favorite'`).
- [ ] **Step 2: Run → FAIL** if the service rejects it (it won't — service is metric-agnostic; the real gate is the DTO). Primary check: the DTO `@IsIn` must accept the new value.
- [ ] **Step 3: Widen the `@IsIn` whitelist** in all 3 DTOs from `['view','search']` to `['view','search','favorite','comment','rating','gift','revenue','listen']` (the `metric` field; `story-top-countries` default stays `'view'`).
- [ ] **Step 4: Run → PASS + typecheck** (from `be/`): `node node_modules/jest/bin/jest.js src/stats` → PASS; tsc exit 0.
- [ ] **Step 5: Commit**
```bash
git add be/src/stats
git commit -m "feat(geo): accept user-action metrics in geo ranking endpoints"
```

---

### Task 8: Full verification

- [ ] **Step 1: Backend** (from `be/`): `node node_modules/jest/bin/jest.js src/common/geo src/stats src/user-features src/chapter-comments src/reviews src/stories src/chapters src/tracking` → all PASS; `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] **Step 2: Manual (BE up, dev DB):** favorite/comment/rating/gift/unlock/listen a story from a resolvable IP → confirm `story_country_daily` gets a row with the right `kind` (`SELECT kind, country, count FROM story_country_daily WHERE story_id='<id>';`); `GET /stats/top-stories-by-country?country=<cc>&metric=favorite` (admin) → 200; verify favorite-remove + already-unlocked + VIP/AD unlock do NOT add buckets.
- [ ] **Step 3: Commit** any fixups.

## Notes / follow-ups
- No new prod migration (reuses B2a's `story_country_daily` — that migration still needs `migrate deploy` on prod).
- **C**: admin UI now has all 9 metrics per-country + global (view/search + favorite/comment/rating/gift/revenue/listen; rating-per-country = count).
- Follow-ups: rating "count first-time only" (needs create-vs-update pre-check); auth `resolveCountry` refactor; Express `trust proxy`; geoip-lite DB update job.
