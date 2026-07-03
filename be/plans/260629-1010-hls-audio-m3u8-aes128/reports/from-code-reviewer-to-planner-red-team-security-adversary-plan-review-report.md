# Red-Team Security Review — HLS m3u8 / AES-128 Plan

Reviewer posture: hostile security adversary + fact checker. Every finding grep-verified against the
actual codebase. Plan reviewed: `plans/260629-1010-hls-audio-m3u8-aes128/*`.

Verdict: **The plan's central security premise — "reuse existing entitlement" — does not survive contact
with the real code.** The key-serving model is architecturally mismatched to the per-variant entitlement
model, one asset type (`ad`) targets a column that does not exist, music VIP semantics are misdescribed,
and the load-bearing key-URI base has no config source. Multiple paid-content-bypass paths.

---

## Finding 1: Key endpoint serves one key per (assetType, assetId) but entitlement is per-variant — paid-variant bypass

- **Severity:** Critical
- **Location:** Phase 2, "Architecture" (`HlsAsset` model, `@@unique([assetType, assetId])`); Phase 4, "Architecture" (`authorize(... variantId?)`, `serveKey(assetType, assetId)`)
- **Flaw:** `HlsAsset` is uniquely keyed by `(assetType, assetId)` with `assetType ∈ {chapter, variant, music, ad}`. But in the real code a single chapter has **its own** chapter-level audio AND multiple `ChapterVariant` rows, each with its **own** `audioUrl`/`r2AudioUrl` and its **own** `unlockPrice`. Entitlement is enforced per variant via `UserUnlockedVariant(userId, variantId)`. The plan's `serveKey(assetType, assetId)` ignores `variantId` entirely when loading the key — it only passes `variantId` to `authorize`. So one key is bound to the chapter, but content may be many distinct paid variants. Either (a) all variants of a chapter share one key/playlist (then unlocking the cheapest variant yields the key for the most expensive one), or (b) variants get `assetType=variant` HlsAssets keyed by `variantId`, but then `getAudioUrl`'s chapter-level entitlement (`accessType`, `unlocksAt`, story unlock) is never applied to the variant key path.
- **Failure scenario:** Chapter has variant A (`unlockPrice=10`) and variant B (`unlockPrice=500`). User unlocks A → gets `UserUnlockedVariant(A)`. Under model (a) the key for the chapter HlsAsset is served, decrypting B's segments too. Under the `findFirst` fallback in `getAudioUrl` (line 619-621: `userUnlockedVariant.findFirst({ where: { userId, variant: { chapterId: id } } })`), ANY unlocked variant authorizes playback when no `variantId` is supplied — so calling the key endpoint without `variantId` after unlocking the cheapest variant authorizes the key for the whole chapter.
- **Evidence:** `src/chapters/chapters.service.ts:607-624` (per-variant unlock, `requiredUnlockPrice = max(unlockPrice, variantUnlockPrice)`, `findFirst` chapter-wide fallback); `prisma/schema.prisma:1063-1096` (each `ChapterVariant` has own `audioUrl`/`r2AudioUrl`/`unlockPrice`); `prisma/schema.prisma:1097-1111` (`UserUnlockedVariant` keyed by variantId); plan `phase-02-schema-key-crypto.md:34` (`@@unique([assetType, assetId])`); plan `phase-04-key-endpoint-entitlement.md:23` (`serveKey(assetType, assetId)` — no variantId).
- **Suggested fix:** Make the key identity match the entitlement identity. Either key `HlsAsset` by the actual audio-bearing row (`assetType=variant` keyed by `variantId`, `assetType=chapter` for chapter-level audio) AND have `serveKey` select by the same `(assetType, id)` the player is fetching, OR explicitly state variants are out of scope. The authorize check and the key-selection MUST use the same identifier; document that one chapter = N keys when it has N paid variants.

---

## Finding 2: `assetType=ad` targets a non-existent audio column — dead/incorrect attack surface

- **Severity:** High
- **Location:** Phase 2 (`enum HlsAssetType { chapter variant music ad }`); Phase 4, "Architecture" (`ad → luôn cho phép (ads free)`); Phase 5 (`AdsService.create/update (audioUrl)`)
- **Flaw:** The plan treats advertisements as an audio asset type with an `audioUrl`, gated as "always allowed." The `Advertisement` model has **no audio field at all** — only `imageUrl`, `targetUrl`, `iframeCode`, `youtubeId`. Ads DTOs have no audio fields either. So `assetType=ad` can never have legitimately transcoded content, and Phase 5's "enqueue on `AdsService.create/update (audioUrl)`" references a property that does not exist.
- **Failure scenario:** Two outcomes, both bad. (1) The `ad` branch is dead code that an attacker probes: `GET /hls/ad/:assetId/key` returns 200 for the always-allow branch, encouraging assetType-confusion attempts (see Finding 3). (2) If a developer wires it up against a wrong column to satisfy the plan, they create a bogus audio pipeline. Either way the plan asserts a capability the schema cannot support.
- **Evidence:** `prisma/schema.prisma:296-325` (Advertisement fields — no `audioUrl`/`r2AudioUrl`); ads DTO grep returned no audio fields (`src/ads/dto/*.ts`); `src/ads/ads.service.ts` references only `isActive` (no audio); plan `phase-02-schema-key-crypto.md:19` (`ad` in enum); plan `phase-04-key-endpoint-entitlement.md:22`; plan `phase-05-enqueue-hooks.md:24` (`AdsService.create/update (audioUrl)`).
- **Suggested fix:** Remove `ad` from `HlsAssetType` and drop the Ads enqueue hook (Phase 5) and the `ad → always allow` branch (Phase 4) unless/until ads gain an audio field. If audio ads are genuinely planned, that is a separate schema change that must be specified, not assumed.

---

## Finding 3: `assetType` is attacker-controlled path input with no validation contract — assetType-confusion / IDOR

- **Severity:** High
- **Location:** Phase 4, "Architecture" (`@Get('hls/:assetType/:assetId/key')`, `authorize(assetType, ...) dispatch theo assetType`)
- **Flaw:** `assetType` and `assetId` are untrusted path params. The plan dispatches the entitlement branch off `assetType` but the key is loaded from `HlsAsset` by `(assetType, assetId)`. Nothing in the plan validates that `assetType` is a member of the enum at the boundary, nor that the entitlement branch chosen matches the asset that actually owns the segments. Because the `ad` branch is "always allow" (Finding 2), an attacker who can get a paid chapter's content indexed under a weaker-gated type, or who guesses that the same `assetId` exists under multiple types, can fetch a key through the permissive branch. Even absent type confusion, `assetId` is an enumerable UUID with no rate limiting mentioned and an `application/octet-stream` 16-byte response that is a perfect oracle (200 = key exists & you're entitled).
- **Failure scenario:** Attacker calls `GET /hls/ad/<paidChapterAssetId>/key`. If any `HlsAsset` row exists for that id under multiple types, or if the dispatch trusts `assetType` for authz but `serveKey` resolves the key loosely, the always-allow `ad` path returns the key. More simply: the permissive branches (free chapter, ad) are reachable by manipulating only the path, with no check that the row's stored `assetType` is the one being authorized.
- **Evidence:** plan `phase-04-key-endpoint-entitlement.md:18-23` (path-param dispatch, `serveKey` loads by `(assetType, assetId)`, `ad → always allow`); `prisma/schema.prisma:296-325` (ads are not audio, so an `ad` HlsAsset is illegitimate yet always-allowed); no input-validation/rate-limit mention anywhere in Phase 4. Existing pattern uses typed guards + `OptionalJwtGuard` (`src/chapters/chapters.controller.ts:95-108`) but never branches authz on a free-form path string.
- **Suggested fix:** Validate `assetType` against the enum via a DTO/`ParseEnumPipe` at the boundary; load the `HlsAsset` first and authorize against the row's stored `assetType` (not the request's), failing closed if they disagree. Add rate limiting on the key endpoint. Drop the "always allow" branch (see Finding 2).

---

## Finding 4: Music entitlement does NOT use user VIP tier — "reuse VIP/unlock" claim is factually wrong

- **Severity:** High
- **Location:** Phase 4, "Architecture" (`music → tái dùng access check trong MusicInteractionService/MusicService (unlock/VIP/free)`); plan.md:31 acceptance ("VIP user → 200")
- **Flaw:** The plan describes music access as the same "VIP/unlock/free" model as chapters, implying user `vipTier` grants access. The real music access path (`getPlayableState`) never reads `vipTier`/`vipExpirationDate` — grep for `vipTier` in `src/music/` returns nothing. Music "vip" is `MusicAccessType.vip` (a per-track flag) satisfied only by a `MusicUnlock` row or playlist propagation, not by the user's VIP membership. Additionally `getPlayableState` requires a non-null `userId` (it is only ever called behind `JwtAccessGuard`) and there is **no music audio-serving/redirect endpoint** today (no `getAudioUrl` equivalent in music). So "mirror `GET /chapters/:id/audio`" has no music analogue to mirror.
- **Failure scenario:** If the implementer follows the plan's stated mental model and adds a user-vipTier shortcut to the music key authorize (as chapters do at `chapters.service.ts:563-566`), every VIP user gets keys for paid music they never unlocked — a revenue bypass that diverges from the product's actual music entitlement. Conversely, the anonymous-free path the plan promises ("free vẫn cho khách") does not exist for music because `getPlayableState` assumes a userId.
- **Evidence:** `grep -rn "vipTier" src/music/` → no matches; `src/music/music-interaction.service.ts:73-161` (`getPlayableState` uses `MusicUnlock`/playlist, no vipTier, requires userId); `src/music/music-interaction.controller.ts:11` (`@UseGuards(JwtAccessGuard)`, line 40-41 passes required userId); no redirect/getAudioUrl in `src/music/*` (grep showed only create/update audioUrl writes). Contrast chapters VIP at `src/chapters/chapters.service.ts:563-604`.
- **Suggested fix:** Rewrite the Phase 4 music section to describe the actual model: authorize via `getPlayableState(userId, musicId).unlocked`, require auth for non-free tracks, handle playlist-vs-track resolution explicitly, and do NOT introduce a user-vipTier bypass for music. Fix acceptance criterion plan.md:31 to specify which asset types VIP applies to.

---

## Finding 5: Key URI in the playlist has no config source — key endpoint may be unreachable or forgeable base

- **Severity:** High
- **Location:** Phase 3, "Architecture" (`key URI = ${apiBase}/hls/${assetType}/${assetId}/key`); plan.md "Open questions" (env for key URI base)
- **Flaw:** The `#EXT-X-KEY:URI=...` written into the playlist at transcode time (Phase 3) must be an absolute URL pointing at the authenticated backend key endpoint — this URI is the *only* thing standing between encrypted public segments and free decryption. The config schema has **no backend/API base URL**: only `FRONTEND_URL` (optional) exists. The plan defers this to an open question, but it is security-load-bearing, not cosmetic. If the implementer points the URI at `FRONTEND_URL` (a frontend host) the key fetch bypasses the NestJS entitlement guard entirely; if left relative, players resolve it against the R2/CDN segment host (public, ungated) — directly serving the key next to the segments.
- **Failure scenario:** Transcode writes `URI="enc.key"` (relative, the Phase 1 default at `phase-01-local-hls-validation.md:24`) or `URI=${FRONTEND_URL}/...`. The encrypted `.ts` segments are public on R2; the player resolves the key URI to the same public R2 prefix or to the frontend, fetching the AES key with no entitlement check. All paid content is freely decryptable. Encrypting segments then publishing the key beside them is equivalent to no encryption.
- **Evidence:** `src/shared/config/app-config.schema.ts:29` (`FRONTEND_URL` optional, no API base); grep for `API_URL|API_BASE|BACKEND_URL|BASE_URL|SELF_URL` in config service → no matches; plan `phase-03-transcode-queue-worker.md:22` (key URI built from `${apiBase}`, undefined source); plan `phase-01-local-hls-validation.md:24` (relative `enc.key` URI default carried as the Phase 3 contract); plan.md:62 (open question, unresolved).
- **Suggested fix:** Add a required, validated `API_PUBLIC_URL` (absolute, https) config and assert at boot that the key URI base equals it. Forbid relative key URIs and forbid using `FRONTEND_URL`. Make this a Phase 2/3 hard requirement (fail-closed), not an open question, since the whole encryption scheme depends on it.

---

## Finding 6: `hlsUrl` masking is described as the gate, but the plan also admits the key is the real gate — inconsistent, leaks playlist + IV

- **Severity:** Medium
- **Location:** Phase 4, "Architecture" (`Expose hlsUrl ... mask khi locked`); plan.md:56 risk ("hlsUrl phải mask khi locked (nhất quán dù key đã gate)")
- **Flaw:** The plan masks `hlsUrl` in responses when locked, implying confidentiality of the playlist. But the playlist itself is public on R2 (segments are public by design) and the playlist embeds the content IV (`#EXT-X-KEY:...,IV=0x...`) and the key URI. The IV is per-asset random and stored in `HlsAsset.keyIv` (Phase 2). Masking `hlsUrl` in the API gives a false sense of protection: anyone who learns the deterministic R2 path (`audio/hls/<assetType>/<assetId>/index.m3u8`, Phase 3) reads the playlist, the IV, and the key URI directly from the bucket, bypassing the API mask. The only real gate is the key endpoint. If that endpoint has any of the gaps in Findings 1/3/5, masking does nothing.
- **Failure scenario:** Attacker ignores the API, GETs `https://<r2-public>/audio/hls/chapter/<id>/index.m3u8` (path is deterministic from Phase 3), obtains IV + key URI + segment list, then attacks the key endpoint. Masking `hlsUrl` never executed. The plan's "consistency" framing treats masking as defense-in-depth but the surrounding facts make it security theater unless the key endpoint is airtight.
- **Evidence:** plan `phase-04-key-endpoint-entitlement.md:25` (mask hlsUrl); plan `phase-03-transcode-queue-worker.md:24` (deterministic public R2 path `audio/hls/<assetType>/<assetId>/`); plan `phase-02-schema-key-crypto.md:30` (IV stored, embedded in playlist per acceptance plan.md:29); plan.md:21 (segments public by design).
- **Suggested fix:** State explicitly that the key endpoint is the sole confidentiality boundary and harden it (Findings 1/3/5). Treat `hlsUrl`/playlist as public. Do not rely on masking for entitlement. Consider not embedding a guessable deterministic R2 path, or keeping playlists out of the public prefix and serving them through an entitled redirect like `GET /chapters/:id/audio`.

---

## Finding 7: HLS_MASTER_KEY format/validation under-specified; wrapped-key blob lacks AAD binding

- **Severity:** Medium
- **Location:** Phase 2, "Config" (`HLS_MASTER_KEY` z.string length hex 64/base64 32) and "Crypto" (`wrapKey` AES-256-GCM `iv(12)+tag(16)+ct`)
- **Flaw:** Two issues. (1) The plan offers both hex-64 and base64-32 as acceptable and defers the decision ("chốt 1 format"); an under-specified key decoder is a classic source of silently-truncated/weak keys (e.g. treating a 32-char hex string as a 32-byte key → 16 bytes of entropy). (2) The GCM wrap has no Associated Data binding the ciphertext to the asset. A stored `encKey` blob is portable: if an attacker with DB write access (or a confused-deputy bug) copies a free asset's `encKey` onto a paid asset's row, GCM still authenticates and `unwrapKey` succeeds, so `serveKey` for the paid asset returns a known key. Binding `assetType|assetId` as GCM AAD makes wrapped keys non-transplantable.
- **Failure scenario:** Hex-vs-base64 ambiguity ships a 16-byte-effective master key (boot passes the length check on the 64-char hex string but the decoder uses utf8 bytes). Separately, a row-copy or import bug moves a free key onto paid content and the key endpoint cheerfully unwraps and serves it because nothing binds the blob to the asset.
- **Evidence:** plan `phase-02-schema-key-crypto.md:41` (dual format, deferred), `:46-47` (`wrapKey`/`unwrapKey` with no AAD), `:75` (risk acknowledges format ambiguity); `src/shared/config/app-config.schema.ts:25` shows the project already enforces min-length on secrets (`INTERNAL_API_KEY ... min(16)`), so a strict pattern is consistent with existing style.
- **Suggested fix:** Pick one encoding, validate with a strict regex AND decoded byte length === 32 (fail-closed at boot). Bind `${assetType}:${assetId}` (and ideally `keyIv`) as GCM AAD in `wrapKey`/`unwrapKey` so a wrapped key only unwraps for its own asset. Add a test that unwrapping with mismatched AAD throws.

---

## Summary of evidence-backed factual errors in the plan

- `Advertisement` has no audio column; `ad` asset type and Ads enqueue hook are unbuildable as written (`prisma/schema.prisma:296-325`).
- Music access never uses `vipTier`; "reuse VIP/unlock" mischaracterizes music semantics and risks adding a VIP bypass (`src/music/music-interaction.service.ts:73-161`, no `vipTier` in `src/music/`).
- No music audio-serving endpoint exists to "mirror"; music access requires authenticated userId (`src/music/music-interaction.controller.ts:11,40`).
- No backend/API base URL config exists for the key URI (`src/shared/config/app-config.schema.ts`); only optional `FRONTEND_URL`.
- `HlsAsset @@unique([assetType, assetId])` cannot represent per-variant keys while entitlement is per-`variantId` (`chapters.service.ts:607-624`, `schema.prisma:1063-1111`).

## Unresolved questions for the planner

1. Per-variant audio: is each paid variant a separate HLS asset+key, and does the key endpoint select the key by the same id it authorizes? (Finding 1 blocks Phase 4.)
2. Are audio ads actually a product requirement? If not, remove `ad` entirely. (Finding 2.)
3. What is the canonical, validated absolute API base URL for the playlist key URI, and is it enforced fail-closed at boot? (Finding 5 blocks Phase 3.)
4. Confirm music is in scope at all given it has no current audio-proxy and a different entitlement model. (Finding 4.)
