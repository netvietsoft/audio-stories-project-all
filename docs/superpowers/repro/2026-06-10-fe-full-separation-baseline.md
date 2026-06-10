# FE Full Separation Baseline Reproduction

## Purpose

This file records smoke checks for the pre-split app so migration regressions can be compared against known behavior.

## Toolchain expectation

- Node target after migration: v24.16.0
- Yarn target after migration: 4.15.0

## Current single-app smoke matrix

Run the current frontend on port 3001 and backend on port 3000 before the split when possible.

### Web routes

- `GET /` redirects to a locale-prefixed route such as `/vi` or `/en`.
- `GET /vi/story` renders the public story surface.
- `GET /vi/music` renders the public music surface.
- `GET /vi/profile` preserves existing protected-route behavior.

### Admin routes

- `GET /vi/admin/login` renders admin login.
- `GET /vi/admin/users` without `refresh_token` redirects to `/vi/admin/login?reason=unauthorized`.
- `GET /vi/admin` renders the current admin dashboard when authenticated.

### Backend auth/cookie

- `POST /auth/login` sets `refresh_token` as HttpOnly cookie and returns `access_token`.
- `POST /auth/refresh` rotates refresh cookie and returns a new `access_token`.
- `POST /auth/logout` should clear `refresh_token`; current code is suspected to fail because clear path does not match set path.
