# FE Handoff — Music `audioUrl` masking (BREAKING) + new `hlsUrl`

**Date:** 2026-06-29
**Scope:** HLS audio plan, Phase 4 (validation decision V2 / red-team H3).
**Audience:** Frontend / API consumers of the music endpoints.

## What changed

The public music read endpoints now require the viewer's entitlement to expose
a paid track's audio:

- `GET /music` (list)
- `GET /music/:slug` (detail)
- `GET /music/:slug/related`

These endpoints now run an **optional JWT** guard. Send the access token when
the user is logged in so their unlocks are recognised.

### Response shape changes (single / podcast tracks)

| Field | Before | After |
|-------|--------|-------|
| `audioUrl` | always returned | **`null`** when the track is paid (`accessType != free`, `unlockPrice > 0`) and the viewer has **not** unlocked it |
| `hlsUrl` | did not exist | **new**: the HLS playlist (`index.m3u8`) URL when a ready HLS asset exists AND the viewer is entitled; otherwise `null` |

Free / zero-price tracks, and tracks the viewer has unlocked (direct
`MusicUnlock` or a playlist unlock covering the track), continue to return
`audioUrl` and now also `hlsUrl` (if transcoded).

Playlists are out of HLS scope: `hlsUrl` is always `null` for `contentType=playlist`.

Admin endpoints (`GET /music/admin`) are **not masked** — admins always see
`audioUrl`. They do, however, also receive the new `hlsUrl` field (additive,
non-breaking) so admin UIs can surface HLS readiness.

### Known scope limitations (accepted)

- **Playlist child tracks**: a playlist's embedded `playlistTracks[].audioUrl`
  is **not** masked, even for paid child tracks an anonymous/unentitled viewer
  cannot play. HLS scope is single-track only (red-team M2); this is the same
  raw-mp3 exposure class as the accepted V1 limitation (raw mp3 in a public
  bucket is reachable by URL). Masking playlist children is a separate effort.

## Why

Previously `serializeMusic` returned `audioUrl` unconditionally, so a paid
track's raw mp3 URL leaked to users who had not purchased it. Masking closes
that leak. Note: this is **defense-in-depth**. The real protection for HLS
content is the AES-128 key endpoint (`GET /hls/music/:id/key`), which is
entitlement-gated; raw mp3 in a public bucket remains reachable by URL guess
(accepted limitation V1 — out of scope, tracked separately).

## Required FE action

- For paid music a user has not unlocked, **do not** expect `audioUrl`. Drive
  the purchase flow from the existing unlock state, and play via `hlsUrl` (HLS)
  once the user is entitled.
- When playing HLS, the player loads `hlsUrl`; the player will fetch the
  decryption key from `GET /hls/music/:id/key` automatically (key endpoint
  enforces entitlement and returns the raw 16-byte AES-128 key).
- Send the auth token on the music read endpoints so unlocked tracks are not
  masked for logged-in buyers.
