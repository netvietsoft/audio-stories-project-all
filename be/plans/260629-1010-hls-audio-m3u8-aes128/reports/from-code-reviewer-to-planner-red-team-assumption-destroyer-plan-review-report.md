# Red-Team Plan Review — Assumption Destroyer / Scope Auditor

Plan: `plans/260629-1010-hls-audio-m3u8-aes128/`
Reviewer role: hostile skeptic (assumption destroyer) + scope auditor.
Method: every claim grep/read-verified against the codebase. No code was modified.

Verdict: **The plan is built on several factual errors about the codebase.** Two phases (4 and 5) assume entities and methods that do not exist as described. Ship-blocking.

---

## Finding 1: Advertisement entity has NO audio — Phase 4 `ad` and Phase 5 `AdsService` are impossible as written

- **Severity:** Critical
- **Location:** Phase 5, "Architecture" / "Điểm gọi" (`AdsService.create/update (audioUrl)`); Phase 4, "Architecture" (`ad` → luôn cho phép); plan.md Overview ("toàn bộ entity ... `Advertisement`").
- **Flaw:** The plan treats `Advertisement` as an audio entity with an `audioUrl` on create/update. The `Advertisement` Prisma model has no audio column at all, and `AdsService` has zero audio handling.
- **Failure scenario:** Phase 5 step "Inject `HlsQueueService` into `AdsService` ... call at create/update (audioUrl)" has nothing to hook into — `dto.audioUrl` does not exist on `CreateAdDto`/`UpdateAdDto`, and there is no source URL to transcode. `HlsAssetType.ad` (Phase 2 enum) becomes dead. Any test asserting "ad create with audioUrl → enqueue" cannot be written against real DTOs. The `audioUrl` the planner saw belongs to `Music`, not `Advertisement`.
- **Evidence:**
  - `prisma/schema.prisma:296-324` — full `Advertisement` model: fields are `imageUrl`, `targetUrl`, `iframeCode`, `youtubeId` — no `audioUrl`/`r2AudioUrl`.
  - `prisma/schema.prisma:327` / `:335` — `model Music { ... audioUrl ... }`; the `audio_url` at line 335 is Music's, which the plan misattributed to Advertisement.
  - `src/ads/ads.service.ts:202-225` (create) and `:227-261` (update) — no audio field written.
  - `grep -rni "audio" src/ads/` → no matches ("NO AUDIO IN ADS").
- **Suggested fix:** Drop `Advertisement`/`ad` from scope entirely (enum value, Phase 4 dispatch, Phase 5 hook), or first add an `audioUrl` column + DTO + upload flow to ads as an explicit prerequisite phase. Do not silently carry `ad` through five phases.

---

## Finding 2: `ChaptersService.getAudioUrl` entitlement is NOT extractable to a pure function without behavior change

- **Severity:** Critical
- **Location:** Phase 4, "Architecture" (`trích logic check vào method dùng chung assertAudioEntitlement() để không nhân đôi`) and Implementation step 2 ("Trích entitlement ... không đổi behavior").
- **Flaw:** The plan assumes entitlement can be lifted into a shared "pure function (Prisma only)". `getAudioUrl` is deeply entangled with multiple Prisma reads AND write side effects (fire-and-forget `userChapterUnlock.upsert` via `setImmediate`) that record unlock events on every successful audio fetch. A key endpoint that reuses this logic will either (a) duplicate those writes — recording bogus unlock rows every time hls.js fetches a key (which happens repeatedly, once per key rotation/segment-group), or (b) omit them and diverge from the "mirror semantics of GET /chapters/:id/audio" requirement.
- **Failure scenario:** hls.js requests the key endpoint potentially many times per playback session. Each call running the `setImmediate` upsert path spams `userChapterUnlock`/credit side effects, inflating unlock metrics and possibly billing-adjacent records. The plan's "no behavior change" guarantee is false because the *call frequency* of the extracted function differs fundamentally from a one-shot audio redirect.
- **Evidence:**
  - `src/chapters/chapters.service.ts:481-639` — `getAudioUrl`: interleaves `chapter.findUnique`, `chapterVariant.findFirst`, `user.findUnique`, `userStoryUnlock.findUnique`, `userUnlockedVariant.findUnique/findFirst`, and three separate `setImmediate(() => userChapterUnlock.upsert(...))` write side effects (`:577`, `:594`, `:626`). This is not a pure function; it is a read+write orchestration.
  - It also resolves and returns the audio `url` (`:532-538`) as part of the same method — entitlement and URL resolution are not separable cleanly.
- **Suggested fix:** Plan must explicitly carve a *read-only* `checkChapterEntitlement(...)` that returns a boolean/enum and contains ZERO writes, leaving the `setImmediate` upserts only in the original `getAudioUrl`. State this as a hard constraint in Phase 4 and add a regression test asserting the key endpoint performs no `userChapterUnlock` writes. The current "extract without behavior change" framing is hand-wavy and will produce the write-amplification bug.

---

## Finding 3: No API base-URL env var exists — absolute key URI in playlist is unspecified

- **Severity:** High
- **Location:** Phase 3, "Architecture" (`key URI = endpoint Phase 4: ${apiBase}/hls/...`) and Risk ("P3 dùng base URL có cấu hình"); plan.md Open questions (already flags this).
- **Flaw:** The plan writes `${apiBase}` as if a config value exists, while the open question admits it does not. Verified: there is no API/public base URL env. `FRONTEND_URL`/`CLIENT_URL` are FE origins; `R2_URL` is the storage CDN. The key endpoint lives on the API host, which has no configured public origin.
- **Failure scenario:** The `keyinfo` file (Phase 1 contract) bakes the key URI **into the playlist at transcode time** in the worker. The worker has no request context (`createApplicationContext`, no HTTP). With no API base var, the planner must invent one mid-Phase-3, or hardcode, or derive from a request that does not exist in the worker. A wrong/empty base produces `#EXT-X-KEY:URI="/hls/..."` that hls.js resolves against the **R2 playlist origin**, not the API — so the player fetches the key from R2 (404, or worse a public 200 with no auth), defeating the entire entitlement gate.
- **Evidence:**
  - `src/shared/config/app-config.schema.ts:29-33` — only `FRONTEND_URL`, `CLIENT_URL`, `ALLOWED_CLIENT_URLS`, `COOKIE_DOMAIN`. `:61` `R2_URL` is storage. No `API_URL`/`PUBLIC_API_URL`/`SELF_URL`.
  - `src/bootstrap.ts:144` — worker runs `createApplicationContext` (no HTTP server, no request host to derive from).
- **Suggested fix:** Add an explicit required config (e.g. `API_PUBLIC_URL`) in Phase 2 and make the key `URI` absolute and pointed at the API origin. Resolve this BEFORE Phase 3, not "chốt ở Phase 3/4". The whole security model hinges on the key URI not resolving to R2.

---

## Finding 4: Relative segment URI + absolute key URI assumes a base-URL model that isn't validated against R2 serving

- **Severity:** High
- **Location:** Phase 3, "Architecture" (`hls-r2.service` ... `Segment URI trong m3u8 để tương đối ... resolve theo R2 base`); Phase 1 (`key URI ... tương đối`).
- **Flaw:** Phase 1 validates a playlist where BOTH key and segments are relative (served by one local http server). Phase 3 then changes the contract to relative segments + absolute key, served from R2. Phase 1 therefore does NOT validate the Phase-3 topology it claims to be "the source of truth" for. The mixed-origin playlist (segments from R2, key from API on a different host) is never proven anywhere in the plan, and crosses a CORS boundary hls.js must satisfy.
- **Failure scenario:** hls.js fetches `index.m3u8` from R2, resolves relative `seg_*.ts` against R2 (OK), but fetches the absolute key URI from the API host. The API key endpoint must send permissive CORS headers for the FE origin AND accept the player's credentials/JWT cross-origin. None of this is in the plan. Result: key fetch blocked by CORS or missing auth header, playback fails in browser despite Phase 1 "passing".
- **Evidence:**
  - Phase 1 line 20 — `key URI (local: enc.key tương đối)`; Phase 1 serves via `python3 -m http.server` (line 28) — single origin, relative everything.
  - Phase 3 line 24 — segment URI relative resolved against R2 base; Phase 3 line 22 — key URI absolute to API.
  - `src/upload/audio-upload.service.ts:69,81` — R2 object URL is `${publicBaseUrl}/${key}` i.e. the R2/CDN origin, confirming segments would resolve to a different host than the API key endpoint.
- **Suggested fix:** Phase 1 must validate the actual Phase-3 topology: m3u8 served from one origin, key from a second origin, with the CORS/credentials configuration the API will use. Add explicit CORS requirements for the key endpoint to Phase 4. Otherwise "Phase 1 is the source of truth" is false.

---

## Finding 5: Music "mask audioUrl when locked" pattern does not exist — Phase 4 hlsUrl masking premise is false for music/ads

- **Severity:** High
- **Location:** Phase 4, "Architecture" / Expose hlsUrl (`khi locked → hlsUrl=null (giống cách mask audioUrl hiện tại)`).
- **Flaw:** The plan claims masking `hlsUrl` mirrors how `audioUrl` is masked today. That masking exists ONLY for chapters (which deliberately omit `audioUrl`/`r2AudioUrl` and force the `/audio` proxy). Music does the opposite: `serializeMusic` returns `...row` including raw `audioUrl: string` unconditionally on every public read. There is no per-viewer entitlement masking in the music read path to "mirror".
- **Failure scenario:** Implementer follows "mirror existing mask" for music, finds nothing to mirror, and either (a) invents a new masking layer in music responses (scope creep, untested behavior change to a heavily-used endpoint) or (b) leaks `hlsUrl` regardless of entitlement. Since the m3u8 itself is the gateway only via the key, leaking `hlsUrl` may be acceptable — but the plan never decides this and asserts a false precedent.
- **Evidence:**
  - `src/chapters/chapters.service.ts:46,83,204,226` — explicit comments: `audioUrl and r2AudioUrl intentionally omitted — use /chapters/:id/audio proxy`.
  - `src/music/music.service.ts:516-522` — `serializeMusic` returns `{ ...row, ... }`, row includes `audioUrl`; no entitlement gate.
  - `src/music/music.service.ts:78-95` `findOnePublic` returns serialized row directly; `:584` exposes child track `audioUrl`. Music audio URLs are public.
- **Suggested fix:** Replace "giống cách mask audioUrl hiện tại" with an explicit per-entity decision: chapters mask (omit), music/ads currently expose raw audio so `hlsUrl` can follow the same exposure. State whether `hlsUrl` is gated or open per entity, and do not introduce a new music masking layer unless that is an accepted, tested scope item.

---

## Finding 6: Phase 1 sample mp3 directory does not exist

- **Severity:** Medium
- **Location:** Phase 1, "Requirements" / "Architecture" (`từ audio-mp3-files/*.mp3`), Implementation step 3 ("Chạy với mp3 mẫu").
- **Flaw:** The plan repeatedly references `audio-mp3-files/` (and the task prompt cites a specific file with spaces, `Full Nếu Ta Ngược Lối - Remix #2_1.mp3`). That directory does not exist in the repo, and there are no `.mp3` files anywhere outside node_modules.
- **Failure scenario:** Phase 1 cannot run "as written" — the implementer must source a sample file first. The space/`#`/diacritic filename risk the plan flags (Phase 1 Risk) is real and good, but it's guarding a path that isn't present, so the very first step blocks on a missing prerequisite.
- **Evidence:**
  - `ls audio-mp3-files/` → "No such file or directory".
  - `find . -path ./node_modules -prune -o -iname "*.mp3" -print` → no results.
- **Suggested fix:** Add an explicit prerequisite in Phase 1: "obtain/commit a sample mp3 to `<path>` (gitignored), or accept an arbitrary input path arg." Keep the arg-list (no shell interpolation) guard — that part is correct.

---

## Finding 7: Music `playlist` is multi-track-by-reference; Phase 5 "single audioUrl" hook will transcode another track's audio under the playlist's HlsAsset

- **Severity:** Medium
- **Location:** Phase 5, "Architecture" (`MusicService.create/update ... mặc định track có audioUrl của music`); plan.md Open questions defers it but Phase 5 still wires it.
- **Flaw:** For `contentType=playlist`, `audioUrl` is set to `resolvedPlaylistTracks[0]?.audioUrl` — i.e. a *copy of the first child track's URL*, not the playlist's own media. Phase 5 would create `HlsAsset(assetType='music', assetId=<playlistId>)` and transcode that borrowed URL. The same child track (as its own `music` single) gets a second `HlsAsset` and a second transcode of identical audio — duplicate work and duplicate R2 storage. Worse, if the child track is paid/VIP, the playlist's key endpoint must evaluate child-track entitlement, which `getPlayableState` explicitly defers ("Track-level unlocks are evaluated when playing each child track").
- **Failure scenario:** A playlist's HLS key endpoint grants/denies based on the playlist-level unlock, but the actual audio is a child track with its own access rules — entitlement mismatch (user pays for playlist, streams a track they didn't unlock, or vice versa). Deferring this as an "open question" while still wiring `music` create/update in Phase 5 means the bug ships unless explicitly excluded.
- **Evidence:**
  - `src/music/music.service.ts:306-312` — playlist branch sets `audioUrl = resolvedPlaylistTracks[0]?.audioUrl`.
  - `src/music/music-interaction.service.ts:153-160` — playlist access "must come from direct playlist unlock; track-level unlocks evaluated per child track."
  - `prisma/schema.prisma` Music `:17` `playlistTrackIds Json?`, `:28` `playlistTracks MusicPlaylistTrack[]` — playlist is a reference container.
- **Suggested fix:** Phase 5 must restrict the music hook to `contentType IN (single, podcast)` (real owned audio) and explicitly skip `playlist`, or resolve the deferred question before wiring. Do not enqueue transcode for playlist rows whose `audioUrl` is a borrowed child URL.

---

## Finding 8: `MusicService.create`/`update` take uploaded `files`, not a plain DTO — Phase 5 "inject + call" oversimplifies the hook point

- **Severity:** Medium
- **Location:** Phase 5, "Architecture" (`MusicService.create/update` ... `enqueueTranscode`); "Source URL = r2AudioUrl ?? audioUrl".
- **Flaw:** Phase 5 models all four services as uniform "create/update with an audioUrl in the dto." Music's `create(dto, files)` resolves the final `audioUrl` only after upload/playlist resolution inside a `$transaction`, and the value can come from an uploaded file, a body URL, or a playlist track. Music also has no `r2AudioUrl` column (unlike Chapter), so the plan's `r2AudioUrl ?? audioUrl` source rule does not apply uniformly.
- **Failure scenario:** A naive "read dto.audioUrl at method entry and enqueue" hook (as the spec examples in Phase 5 TDD imply: "music create có audioUrl → gọi") fires with the wrong/empty URL because the real `audioUrl` is computed mid-transaction. The enqueue must happen post-commit with the *resolved* URL, which differs per entity. The plan's single `registerAsset(assetType, assetId, sourceUrl)` helper hides this divergence.
- **Evidence:**
  - `src/music/music.service.ts:282` `async create(dto: CreateMusicDto, files: UploadFiles)`; resolved `audioUrl` computed at `:303-317`, written inside `$transaction` at `:336+`.
  - Music `SerializableMusicRow` (`:31,46`) has `audioUrl` but no `r2AudioUrl`; chapters use `r2AudioUrl ?? audioUrl` (`chapters.service.ts:532-535`) — the source rule is entity-specific.
- **Suggested fix:** Phase 5 should specify per-service the exact post-commit point and the resolved source URL expression (chapter/variant: `r2AudioUrl ?? audioUrl`; music single/podcast: resolved `audioUrl`). Update the TDD examples to assert enqueue with the resolved URL, not "dto has audioUrl."

---

## Lower-confidence notes (not numbered findings)

- **Circular deps (Phase 4):** plausible but manageable. `ChaptersModule` exports `ChaptersService` (`chapters.module.ts:12`), `MusicModule` does not export its services (`music.module.ts:17`). For `HlsModule` to call music entitlement it needs `MusicModule` to export the relevant service, or to extract a shared provider. The plan's "prefer extracting a pure function to `src/common`" is the right instinct and likely avoids `forwardRef`. No false claim here, but Phase 4 should note `MusicModule` currently exports nothing.
- **APP_ROLE worker context (Phase 3):** verified compatible — `bootstrap.ts:144` already starts a Nest application context for non-HTTP roles, so a conditionally-provided `@Processor` will instantiate. Claim holds.
- **bullmq dep:** correctly identified as new; `ioredis@^5` already present (`package.json:67`), so the Redis client foundation exists.

---

## Unresolved questions for the planner
1. Is `Advertisement` audio in scope at all? If not, remove `ad` from the enum and all phases.
2. What is the API public origin env var, and does the key endpoint need cross-origin CORS for the FE? (blocks Phase 3 key URI + Phase 4 endpoint).
3. Is `hlsUrl` gated per-viewer or exposed like music's raw `audioUrl`? Decide per entity.
4. Playlist music: in or out of Phase 5? If in, how is child-track entitlement reconciled with the playlist-level key?
