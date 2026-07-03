# HLS (AES-128) Audio Feature — Code Review

**Reviewer:** code-reviewer (Staff Engineer, production-readiness lens)
**Date:** 2026-06-29
**Scope:** `git diff` vs HEAD — `src/hls/*`, modified chapters/variants/music services + modules, config schema/service, app.module, prisma schema + migration, Dockerfile/deploy/env.
**Posture:** Authorization correctness was treated as the primary security boundary and verified line-by-line against the existing playback rules.

## Overall Assessment

Solid, well-scoped implementation. The security-critical paths — entitlement read-only-ness, per-variant isolation, music-no-VIP, AAD-bound key wrap, fail-closed config, crash-safe upload ordering, worker-only consumer — all check out against the acceptance criteria and against the source-of-truth logic in `chapters.service.ts` / `music-interaction.service.ts`. No Critical or High authorization bypass found. 42 HLS unit tests pass. The findings below are correctness/consistency gaps and documentation drift, none of which open the key gate.

## Acceptance Criteria Verification

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Key endpoint status codes (400/403/404) + raw 16-byte octet-stream | PASS — `hls.controller.ts:42-55`, `hls-access.service.ts:49-56` |
| 2 | Entitlement READ-ONLY (no writes, unlike `getAudioUrl`'s `setImmediate` upsert) | PASS — `hls-entitlement.ts` does only `findUnique`/`findFirst`/`findMany` |
| 3 | Per-variant isolation (variant A unlock ≠ variant B / whole chapter) | PASS — `hls-entitlement.ts:101-106` uses `userId_variantId` unique lookup when `variantId` present |
| 4 | Music uses MusicUnlock, NOT vipTier | PASS — `checkMusicEntitlement` never reads `user.vipTier`; matches `getPlayableState` single-track path |
| 5 | AAD binds `${assetType}:${assetId}` | PASS — `hls-key.service.ts:40-51` |
| 6 | Worker-only consumer; producer everywhere | PASS — `hls.module.ts:15-16` gates `HlsProcessor` on `APP_ROLE==='worker'` |
| 7 | Crash-safety: segments before playlist; ready only after playlist; fail→failed | PASS — `hls-r2.service.ts:100-113`, `hls.processor.ts:69-101` |
| 8 | Fail-closed config (master key / PUBLIC_API_URL) | PASS — zod schema `app-config.schema.ts` + `HlsKeyService` ctor regex throw |

## Critical Issues

None.

## High Priority

None affecting the security boundary. (Items below are correctness/consistency.)

## Medium Priority

### M1 — Admin music response shape changed despite handoff doc saying "unchanged"
**File:** `src/music/music.service.ts:780-787` (`applyEntitlementMasking` no-viewer branch); doc `reports/fe-handoff-music-audiourl-masking-breaking-change.md` ("Admin endpoints … unchanged — no masking").

The admin path (`findAllAdmin` → `findByQuery(query, false)` → no `viewer`) still flows through `applyEntitlementMasking`, which **adds a new `hlsUrl` field** to every admin item. The handoff explicitly states admin responses are unchanged. This is additive (non-breaking) but contradicts the documented contract, and means admin now triggers an extra `hlsAsset.findMany` per list page.

**Impact:** Low runtime risk; contract/documentation drift. An admin client relying on exact shape, or the handoff as the source of truth, is misled.
**Fix:** Either (a) update the handoff doc to note admin gains `hlsUrl`, or (b) skip masking/enrichment entirely for the admin path so it truly stays unchanged. Pick one and make code + doc agree.

### M2 — Playlist child-track `audioUrl` is never masked for unentitled viewers
**File:** `src/music/music.service.ts:741-759` (playlist serialization) + `applyEntitlementMasking:803-811`.

For a `playlist` row, masking sets `allowed = true` unconditionally (`isPlaylist ? true : …`), so the embedded `playlistTracks[].audioUrl` (raw mp3 URLs of paid child tracks) is returned in full to any public/anonymous viewer. The masking only nulls the **top-level** item's `audioUrl`, never the nested child URLs.

This is **pre-existing behavior** (the old `enrichPlaylistTracks` already returned child `audioUrl` unconditionally), so it is not a regression introduced by this diff. But it is the exact leak class the V2 masking set out to close, and the new code leaves it open for the playlist-children case. The handoff frames masking as "defense-in-depth" and notes raw-mp3-by-URL is an accepted V1 limitation, so this may be intentional — but it is not called out.

**Impact:** A paid child track's raw mp3 URL is discoverable by fetching the parent playlist detail, even by anonymous users. Defense-in-depth only; HLS key gate is the real control.
**Fix:** If child-track masking is in scope, run the per-track entitlement check over `playlistTracks` and null `audioUrl` for unentitled children. If out of scope (V1 accepted limitation), document it explicitly in the handoff so it is a recorded decision, not a silent gap.

## Low Priority

### L1 — `.env.example` ships an all-zero master key that passes the fail-closed regex
**File:** `.env.example` (`HLS_MASTER_KEY=000…0`).

64 hex zeros satisfy `MASTER_KEY_RE`, so a deployment that copies `.env.example` verbatim boots successfully with a publicly-known wrapping key. The fail-closed check only catches *malformed* keys, not weak/default ones.
**Fix:** Use an obviously-invalid placeholder (e.g. `replace-me`) so a copied env fails closed at boot, or add a deploy-time guard rejecting the all-zero key in production. Comment already says "generate with openssl"; the placeholder undercuts it.

### L2 — `findRelatedPublic` N+1 entitlement checks
**File:** `src/music/music.service.ts:798-802` (`applyEntitlementMasking` loops `await checkMusicEntitlement` per track).

Each non-playlist item triggers a sequential `checkMusicEntitlement`, and each of those does a `findUnique` + (for paid tracks) a `music.findMany({where:{contentType:'playlist'}})` scanning **all playlists** (`hls-entitlement.ts:152-155`, mirrored from `findPlaylistUnlockForTrack`). On a list/related page of N paid tracks this is N sequential round-trips, each scanning the full playlist set.

**Impact:** Bounded by page size (list `limit` default 12, related capped at 20), so not unbounded, but it is serial and each call is a table scan of playlists. Will degrade as the playlist catalog grows.
**Fix:** `Promise.all` the per-track checks (they are independent), and/or hoist the "all playlists + their trackIds" load once per request and pass it into the checks. This mirrors a pattern already duplicated between `hls-entitlement.ts` and `music-interaction.service.ts` — consider sharing one helper.

### L3 — Duplicated playlist-unlock logic between `hls-entitlement.ts` and `music-interaction.service.ts`
**File:** `hls-entitlement.ts:151-169` vs `music-interaction.service.ts:233-264` (`findPlaylistUnlockForTrack`) and `parsePlaylistTrackIds`.

The HLS entitlement re-implements the "track unlocked via owning playlist" lookup and playlist-id parsing already present in `MusicInteractionService`. Behavior matches today, but two copies of an authorization rule will drift. Not a defect now; a maintenance risk for a security-relevant rule.
**Fix:** Extract one shared, read-only helper used by both. (Per project Rule 3 / DRY; flagged, not to be refactored unprompted.)

## Edge Cases Checked (no defect)

- **Re-transcode versioning:** new `runId` per job, old versions pruned only *after* the new playlist is live and `status=ready` (`hls.processor.ts:87-94`, `hls-r2.service.ts:124-162`). A reader mid-playback on the old version is not yanked before the new one exists. Cleanup failure is logged, not fatal. Good.
- **Asset deleted between enqueue and processing:** handled — processor warns and returns (`hls.processor.ts:40-46`).
- **Enqueue failure leaves row `pending`:** caught and logged, entity not rolled back; reconcile cron (`hls-reconcile.service.ts`) re-enqueues stale `pending` rows older than 10m. Dedupe `jobId` makes re-enqueue idempotent. Good.
- **`@Cron` reconcile only in scheduler role:** `ScheduleModule.forRoot()` is only imported when `APP_ROLE=scheduler` (`app-role.util.ts:32-40`); `@Cron` is inert otherwise. Correct.
- **AAD/tamper mismatch on unwrap:** `decipher.final()` throws; surfaces as a generic 500 with no internal leak. Fail-closed.
- **Anonymous public music reads:** `OptionalJwtGuard` returns `null` (never throws); `viewer={userId:undefined}` is still a truthy object so masking applies for anonymous callers. Correct — anonymous gets masked, not bypassed.
- **Enqueue timing:** chapter/variant/music all call `registerAsset` *after* the `$transaction`/commit; updates gate on `audioChanged` (`chapters.service.ts:943,964`, `chapter-variants.service.ts:133-136`, `music.service.ts` update `audioChanged`). Music restricts to `contentType === single` (`registerMusicHls:80-82`). Matches spec.
- **No secret leakage in logs:** grepped all `src/hls` logger calls — only `assetType:assetId`, counts, durations, error messages. No key bytes, no master key. Good.
- **ffmpeg args:** discrete arg array via `execFile` (`buildFfmpegArgs`), no shell interpolation — safe for spaced/`#` paths and injection-free. Source path is a controlled temp file, not user input. Good.
- **`ads` accessType chapter:** entitlement priced branch checks `userUnlockedVariant`, matching source `getAudioUrl:711-723` (which also checks only `userUnlockedVariant`, not `userChapterUnlock`). Consistent — not a new divergence.

## Public Contract Changes (intended vs found)

- **Intended (documented):** music `audioUrl` masking + new `hlsUrl` on public single/podcast reads; three public music GETs now run `OptionalJwtGuard`. Verified present and correct.
- **Found beyond doc:** admin music responses gain `hlsUrl` (M1). Chapters/variants `hlsUrl` exposure intentionally deferred (proxy model) — confirmed not exposed.

## Metrics

- HLS unit tests: 42 passed (6 suites). e2e (`test/hls-key.e2e-spec.ts`) deferred pending local migration apply — expected per context, not a defect.
- Type/lint/build: reported green by author; not re-run here (no code changes made by reviewer).
- New authz surface: 1 endpoint (`GET /hls/:assetType/:assetId/key`), throttled 30/60s, OptionalJwt-gated, entitlement-checked. No IDOR found — assetId is validated against owning asset row and entitlement before key release.

## Recommended Actions (prioritized)

1. **M1** — Reconcile admin `hlsUrl` addition with the handoff doc (update doc or skip admin enrichment).
2. **M2** — Decide and document whether playlist child-track `audioUrl` masking is in scope; close or record as accepted.
3. **L1** — Make `.env.example` master key an invalid placeholder so copy-paste fails closed.
4. **L2/L3** — Parallelize per-track entitlement checks and extract the shared playlist-unlock helper to prevent authz-rule drift (defer if out of current scope).

## Unresolved Questions

- Is the playlist child-track `audioUrl` exposure (M2) an accepted V1 limitation (like raw-mp3-by-URL) or an oversight? The answer determines whether M2 is "document it" or "fix it".
- Should admin truly stay byte-for-byte unchanged (M1)? If an admin UI consumes `hlsUrl`, the doc is wrong, not the code.

---

Status: DONE_WITH_CONCERNS
Summary: HLS feature passes all 8 acceptance criteria and the authorization boundary is sound (no bypass/IDOR/leak in the key gate). Findings are 2 Medium (admin shape vs doc drift; playlist child-track audioUrl not masked — pre-existing) and 3 Low (weak default key placeholder, N+1 entitlement checks, duplicated authz logic).
Concerns: M2 child-track leak and M1 admin-shape drift need a product/doc decision; neither opens the AES key gate. No code modified.
