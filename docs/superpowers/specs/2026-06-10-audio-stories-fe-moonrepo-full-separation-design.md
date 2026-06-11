# Audio Stories FE moonrepo full separation design

- Date: 2026-06-10
- Status: Approved design, pre-planning
- Scope: `fe/` primary, `be/` minimal auth/CORS/cookie support only
- Chosen option: Full separation — 2 independent Next.js apps (`web`, `admin`) managed by moonrepo, with shared packages

## 1. Executive summary

Refactor the current single Next.js frontend in `fe/` into a moonrepo workspace with 2 independent App Router applications:

- `apps/web` → public user-facing site on `web.example.com`
- `apps/admin` → admin site on `admin.example.com`

Keep current business logic and API contracts intact wherever possible. Make only the minimum backend changes required to support cross-subdomain auth and CORS.

The design keeps the public site and admin site fully separated at runtime and deploy time, while sharing only well-bounded libraries for locale, env, auth constants, and small cross-app UI/helpers.

## 2. Objectives

1. Separate the current FE into 2 independent Next.js apps.
2. Manage the FE workspace with moonrepo.
3. Pin FE toolchain to Node `24.16.0` and Yarn `4.15.0`.
4. Preserve current user flows, admin flows, middleware behavior, API contracts, and SEO/public routes unless an intentional compatibility redirect is defined.
5. Keep migration reversible and verify each phase with buildable checkpoints.
6. Add only minimal backend changes for subdomain auth, refresh cookie domain handling, and CORS.

## 3. Non-goals

1. No database schema changes.
2. No feature redesign.
3. No broad UI cleanup or style refactor.
4. No package churn without evidence.
5. No PnP migration in this refactor.
6. No admin OAuth redesign unless a real failure forces it.

## 4. Current state summary

The current `fe/` is a single Next.js App Router app with:

- locale segment `[lang]`
- web routes under `src/app/[lang]/(main)`
- admin routes under `src/app/[lang]/admin`
- shared locale layout wrapping both web and admin
- a single `src/middleware.ts` handling locale redirect, user protected routes, and admin route protection
- web-only player/auth modal behavior suppressed on admin by pathname checks
- no FE lockfile, no FE `packageManager`, and no FE `.yarnrc.yml`

High-risk coupling points in the current codebase:

1. `src/app/[lang]/layout.tsx` wraps both web and admin.
2. `src/middleware.ts` mixes locale + web auth + admin auth.
3. admin and user auth share backend refresh mechanics but use different access token storage.
4. Next local API routes under `src/app/api/**` serve both public and admin use cases.
5. deploy/runtime scripts assume a single FE app.

## 5. Chosen architecture

### 5.1 Workspace layout

```txt
fe/
  .moon/
    workspace.yml
    toolchain.yml
    tasks.yml

  apps/
    web/
      src/
      public/
      messages/
      next.config.ts
      middleware.ts
      tsconfig.json
      eslint.config.mjs
      tailwind.config.ts
      postcss.config.mjs
      package.json
      moon.yml

    admin/
      src/
      public/
      messages/
      next.config.ts
      middleware.ts
      tsconfig.json
      eslint.config.mjs
      tailwind.config.ts
      postcss.config.mjs
      package.json
      moon.yml

  packages/
    shared/
      src/
      package.json
      tsconfig.json
      moon.yml

    ui/
      src/
      package.json
      tsconfig.json
      moon.yml

    api-client/
      src/
      package.json
      tsconfig.json
      moon.yml

  e2e/
    web/
    admin/
    api/

  package.json
  yarn.lock
  .yarnrc.yml
  .nvmrc
  tsconfig.base.json
```

### 5.2 Moon workspace

Use explicit project mapping in `.moon/workspace.yml`:

```yaml
projects:
  web: 'apps/web'
  admin: 'apps/admin'
  shared: 'packages/shared'
  ui: 'packages/ui'
  apiClient: 'packages/api-client'

defaultProject: 'web'
```

### 5.3 Toolchain contract

- Node: `24.16.0`
- Yarn: `4.15.0`
- Root FE `package.json` must contain `"packageManager": "yarn@4.15.0"`
- Root FE `.yarnrc.yml` must use `nodeLinker: node-modules`

This design intentionally avoids Yarn PnP because the current stack includes Next.js 16, Playwright, UploadThing, Sharp, local route handlers, and monorepo package transpilation. `node-modules` is the lowest-risk migration mode.

## 6. Runtime topology

### 6.1 Domains

Production examples in this spec use:

- web: `https://web.example.com`
- admin: `https://admin.example.com`
- API/backend: `https://api.example.com`

The final implementation must not hardcode these values. They are configuration examples only.

### 6.2 Web route contract

Web remains locale-prefixed:

```txt
https://web.example.com/
https://web.example.com/vi
https://web.example.com/en
https://web.example.com/vi/story
https://web.example.com/vi/music
https://web.example.com/vi/profile
https://web.example.com/vi/auth/google/callback
```

Current public redirects remain in the web app, for example:

- `/:lang/new -> /:lang/story/new`
- `/:lang/trending -> /:lang/story/trending`
- `/:lang/stories/:slug -> /:lang/story/stories/:slug`

### 6.3 Admin route contract

Admin becomes route-clean on the admin subdomain:

```txt
https://admin.example.com/
https://admin.example.com/vi
https://admin.example.com/en
https://admin.example.com/vi/login
https://admin.example.com/vi/users
https://admin.example.com/vi/stories
https://admin.example.com/vi/settings
```

### 6.4 Admin compatibility redirects

The admin app must preserve backward compatibility for old admin paths:

```txt
/admin                         -> /vi
/:lang/admin                   -> /:lang
/:lang/admin/login            -> /:lang/login
/:lang/admin/:path*           -> /:lang/:path*
```

Query strings must be preserved:

```txt
/vi/admin/login?reason=unauthorized -> /vi/login?reason=unauthorized
```

## 7. Ownership model

### 7.1 Web app ownership

Move to `apps/web`:

- current web routes under `src/app/[lang]/(main)`
- web auth pages and callbacks
- `src/app/[lang]/music/**`
- `src/app/[lang]/notifications/**`
- `robots.ts`, `sitemap.ts`
- web layout/components/player/story/music/payment/profile/auth
- user providers/stores/hooks/libs
- web-facing local route handlers:
  - `/api/avatar/delete`
  - `/api/public/stories/**`
  - `/api/uploadthing` if needed by web avatar upload flow

### 7.2 Admin app ownership

Move to `apps/admin` with route cleanup:

- `src/app/[lang]/admin/page.tsx` → `src/app/[lang]/page.tsx`
- `src/app/[lang]/admin/login/page.tsx` → `src/app/[lang]/login/page.tsx`
- all current admin CRUD pages become clean localized paths under `src/app/[lang]/*`
- admin layout/components/store/hooks/types/libs
- admin-facing local route handlers:
  - `/api/chapter-audio/delete`
  - `/api/chapter-thumbnail/delete`
  - `/api/uploadthing` if needed by admin upload forms

### 7.3 Shared package ownership

#### `packages/shared`

Own only non-UI, non-app-specific code:

- locale constants and helpers
- shared env schema/helpers
- auth constants
- middleware helpers
- small cross-app utilities such as `formatChapterTitle` if truly shared
- shared types that do not depend on app-specific state or UI

#### `packages/ui`

Own only true cross-app UI/helpers, for example:

- `LocalizedLink`
- `LanguageFlagIcon`
- small shared primitives used by both apps

Do not move web-only or admin-only shells into `ui`.

#### `packages/api-client`

Own small reusable HTTP/auth helpers. Keep store-specific axios client behavior inside each app unless an evidence-backed refactor proves a shared factory is safe.

## 8. Auth, cookie, CORS, middleware

### 8.1 Auth invariants to preserve

- refresh token remains `HttpOnly`
- refresh token is never written to localStorage
- refresh token is never returned in response bodies
- access token remains the client-side Bearer token
- web and admin continue to use `withCredentials: true`
- locale cookie remains `NEXT_LOCALE`

### 8.2 Minimal backend changes

Backend changes are limited to what is required for subdomain support:

1. Add origin env support:
   - `WEB_ORIGIN`
   - `ADMIN_ORIGIN`
   - retain compatibility with `FRONTEND_URL`, `CORS`, `CLIENT_URL`, `ALLOWED_CLIENT_URLS`
2. Add cookie env support:
   - `COOKIE_DOMAIN`
   - `COOKIE_SAME_SITE`
   - `COOKIE_SECURE`
3. Centralize refresh cookie options.
4. Fix logout cookie clearing so clear options match set options.

### 8.3 Backend env examples

Example local backend env:

```env
WEB_ORIGIN=http://localhost:3001
ADMIN_ORIGIN=http://localhost:3002
FRONTEND_URL=http://localhost:3001
CLIENT_URL=http://localhost:3001
ALLOWED_CLIENT_URLS=http://localhost:3001,http://localhost:3002
CORS=http://localhost:3001,http://localhost:3002
COOKIE_DOMAIN=
COOKIE_SAME_SITE=lax
COOKIE_SECURE=false
```

Example production backend env:

```env
WEB_ORIGIN=https://web.example.com
ADMIN_ORIGIN=https://admin.example.com
CLIENT_URL=https://web.example.com
ALLOWED_CLIENT_URLS=https://web.example.com,https://admin.example.com
CORS=https://web.example.com,https://admin.example.com
COOKIE_DOMAIN=.example.com
COOKIE_SAME_SITE=lax
COOKIE_SECURE=true
```

### 8.4 Web middleware responsibilities

The web app middleware must:

- skip static/internal paths
- add locale if missing
- protect user-only paths
- redirect authenticated users away from public auth pages where current behavior expects it
- set `NEXT_LOCALE`

The web middleware must not contain admin route logic.

### 8.5 Admin middleware responsibilities

The admin app middleware must:

- skip static/internal paths
- redirect old `/admin` and `/:lang/admin/*` compatibility paths to clean localized admin routes
- add locale if missing
- allow `/:lang/login`
- protect all other localized admin routes via `refresh_token` cookie
- set `NEXT_LOCALE`

This preserves server-side admin guarding instead of weakening admin protection to client-only checks.

## 9. Next.js monorepo configuration

Each app uses Next.js App Router with local package transpilation.

Both apps must set `transpilePackages` for local workspace libraries:

- `@audio-stories/shared`
- `@audio-stories/ui`
- `@audio-stories/api-client`

Because the apps live under `apps/*`, each app should also set `outputFileTracingRoot` to the FE workspace root so shared package files are included in traced output for deployable builds.

### 9.1 Web Next config

The web app keeps:

- `next-intl` plugin
- current public redirects
- image remote patterns
- PWA integration

### 9.2 Admin Next config

The admin app keeps:

- `next-intl` plugin
- image remote patterns if required by admin media screens
- compatibility redirects for old admin URLs

The admin app must not enable the web PWA plugin.

## 10. Package manager and dependency strategy

### 10.1 Root FE package manager contract

Root FE `package.json` must be:

```json
{
  "private": true,
  "packageManager": "yarn@4.15.0",
  "workspaces": ["apps/*", "packages/*"],
  "engines": {
    "node": "24.16.0"
  }
}
```

### 10.2 Initial dependency policy

Do not mass-upgrade packages. Upgrade only when there is evidence:

1. install failure
2. build failure
3. peer/engine incompatibility
4. official documentation mismatch
5. security-critical reason

Expected likely adjustment:

- align `@types/node` from `^20` to a Node 24-compatible release

### 10.3 Dependency placement

- root FE devDependencies: tooling shared by the workspace
- app package dependencies: app runtime dependencies
- shared/ui/api-client dependencies: only direct imports they actually use
- no dependency hiding at the workspace root just to reduce duplication

## 11. TypeScript strategy

Use a root `tsconfig.base.json` shared by apps and packages.

To minimize migration risk, keep the initial compiler target aligned with the current app rather than introducing an unrelated emit/target change during the split. Target modernization can be a later task if needed.

Each app keeps local `@/*` alias pointing at its own `src/*`. Shared code must be imported by package name, never by reaching into another app's source tree.

## 12. Local API route ownership

### 12.1 Web-owned handlers

- `/api/avatar/delete`
- `/api/public/stories/[slug]`
- `/api/public/stories/explore`
- `/api/uploadthing` if required by web profile/avatar flow

### 12.2 Admin-owned handlers

- `/api/chapter-audio/delete`
- `/api/chapter-thumbnail/delete`
- `/api/uploadthing` if required by admin media forms

### 12.3 UploadThing strategy

Preferred: keep app-local route wrappers and share router config only if the current UploadThing setup can be extracted safely without app-local imports. If not, duplicate first, then deduplicate after build verification.

## 13. Public assets and PWA

### 13.1 Web public assets

Move the current public assets into `apps/web/public` and preserve current web behavior.

The web app owns:

- `manifest.json`
- icon assets
- SEO/public static assets
- PWA output

### 13.2 Admin public assets

Admin gets only what it needs for shell/favicon/logo behavior.

### 13.3 Existing manifest/icon mismatch

The current manifest appears to reference `/icon/...` while present assets appear under `/icons/...`. This is a discovered issue, not an automatic scope expansion. Preserve behavior first; only fix if build/runtime verification proves it is broken.

## 14. Environment example files

### 14.1 FE root `.env.example`

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_R2_URL=
NEXT_PUBLIC_UPLOADTHING_URL=
NEXT_PUBLIC_AUTH_LOGIN_PATH=/login
NEXT_PUBLIC_AUTH_HOME_PATH=/
```

### 14.2 Web `.env.example`

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_R2_URL=
NEXT_PUBLIC_UPLOADTHING_URL=
NEXT_PUBLIC_AUTH_LOGIN_PATH=/login
NEXT_PUBLIC_AUTH_HOME_PATH=/
```

### 14.3 Admin `.env.example`

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3002
NEXT_PUBLIC_R2_URL=
NEXT_PUBLIC_UPLOADTHING_URL=
NEXT_PUBLIC_AUTH_LOGIN_PATH=/login
NEXT_PUBLIC_AUTH_HOME_PATH=/
```

## 15. E2E split

Split FE end-to-end tests by concern:

```txt
fe/e2e/
  web/
    seo.spec.ts
    user-flow.spec.ts
    ui-notifications.spec.ts
  admin/
    admin-flow.spec.ts
  api/
    security.spec.ts
    api-notifications.spec.ts
```

Use one root Playwright config with separate projects for:

- `web`
- `admin`
- `api`

Key env variables:

```env
WEB_URL=http://localhost:3001
ADMIN_URL=http://localhost:3002
BE_URL=http://localhost:3000
BE_DIR=../be
```

Current tests that assume `process.cwd()` must be updated to accept explicit env-backed paths where needed.

## 16. Migration phases

### Phase 0 — Baseline capture

- capture current routes, auth behavior, package versions, and minimal smoke expectations

### Phase 1 — Workspace bootstrap

- root FE workspace files
- Yarn 4 pin
- moon config
- lockfile generation
- empty app/package skeletons

### Phase 2 — Shared packages extraction

- `shared`
- `ui`
- `api-client`
- package exports and typecheck

### Phase 3 — Web app migration

- move web routes/components/providers/stores/hooks/libs/public/messages
- wire web middleware and config
- keep web PWA
- assign web local route handlers

### Phase 4 — Admin app migration

- move admin pages to clean localized routes
- update admin links and redirects
- wire admin middleware and config
- assign admin local route handlers

### Phase 5 — Backend compatibility support

- multi-origin CORS
- shared refresh cookie options
- correct logout cookie clearing
- backend env examples

### Phase 6 — E2E/config/deploy split

- split specs
- Playwright projects
- env docs
- deploy/runtime scripts updated for dual apps

### Phase 7 — Cleanup and final review

- remove stale single-app leftovers only after both apps build and smoke pass
- final lint/typecheck/build review

## 17. Verification plan

### 17.1 Toolchain

- `node -v` is `v24.16.0`
- `yarn --version` is `4.15.0`
- `yarn install --immutable` passes
- moon project graph/list commands pass

### 17.2 Static/build checks

- `shared:typecheck`
- `ui:typecheck`
- `apiClient:typecheck`
- `web:typecheck`
- `admin:typecheck`
- `web:build`
- `admin:build`

### 17.3 Runtime smoke

#### Web

- root locale redirect works
- `/vi/story` renders web layout
- `/vi/music` renders web layout
- `/vi/profile` preserves auth behavior
- no admin shell appears in web app

#### Admin

- root locale redirect works
- `/admin -> /vi`
- `/:lang/admin -> /:lang`
- `/:lang/admin/login -> /:lang/login`
- unauthenticated protected pages redirect to login with reason
- successful admin login lands on `/:lang`
- no web navbar/player/auth modal appears in admin app

### 17.4 Auth/cookie/CORS

- web login + refresh pass
- admin login + refresh pass
- logout actually clears refresh cookie
- explicit origins work
- unknown origin rejects in production-like config

### 17.5 Local API routes

- web avatar upload/delete pass
- public story cache routes pass
- admin chapter media deletion pass
- UploadThing usage works in owning apps

### 17.6 E2E smoke

- web SEO smoke
- web user-flow smoke
- admin redirect/auth smoke
- API-focused subset where env allows

## 18. Rollout plan

### 18.1 Local

Run:

- web on `3001`
- admin on `3002`
- backend on `3000`

Verify both against the same backend.

### 18.2 Staging

Recommended staging topology:

- `https://web-staging.example.com`
- `https://admin-staging.example.com`
- `https://api-staging.example.com`

Verify:

- cookie domain behavior
- CORS behavior
- admin compatibility redirects
- web OAuth callback
- web manifest/assets

### 18.3 Production

Recommended order:

1. deploy backend support first
2. deploy web app
3. deploy admin app
4. cut over proxy/DNS as needed
5. monitor 401, CORS, upload, and asset errors

## 19. Rollback plan

### 19.1 FE rollback

Because web and admin are separated:

- web can be rolled back independently
- admin can be rolled back independently
- full FE rollback remains possible if routing or cutover fails globally

### 19.2 Backend rollback

Backend rollback is env/config level and code-light:

- revert extra origin usage
- revert cookie domain settings
- revert refresh cookie helper if necessary

### 19.3 Database rollback

No database rollback is needed because this refactor has no DB migration.

## 20. Risks and mitigations

### Risk 1 — cross-subdomain auth fails

Mitigation:

- backend cookie domain config
- backend CORS support for both web and admin
- protected admin route verification before rollout

### Risk 2 — package resolution fails under Yarn 4

Mitigation:

- use `nodeLinker: node-modules`
- declare dependencies in the correct workspace
- keep upgrades minimal and evidence-backed

### Risk 3 — shared package imports create cycles

Mitigation:

- apps depend on packages
- packages never depend on apps
- `shared` is lowest layer

### Risk 4 — compatibility redirects break bookmarks/tests

Mitigation:

- explicit admin compatibility redirect matrix
- redirect smoke tests with query preservation

### Risk 5 — local route handlers end up in the wrong app

Mitigation:

- explicit route ownership list
- upload/delete/public cache runtime smoke checks

## 21. Final implementation guardrails

1. Move code first, redesign later.
2. Keep public and admin app logic behaviorally equivalent to today.
3. Do not silently remove existing compatibility paths.
4. Do not weaken server-side admin protection.
5. Do not introduce unrelated dependency churn.
6. Update `.env.example` files in lockstep with runtime config changes.
7. Remove old single-app files only after both new apps build and smoke pass.

## 22. Definition of success

This design is successful when all of the following are true:

1. FE is a moonrepo-managed workspace.
2. FE uses Node `24.16.0` and Yarn `4.15.0`.
3. `web` and `admin` are independent Next.js apps.
4. web and admin run on independent domains/subdomains.
5. admin clean routes work, and old admin URLs redirect correctly.
6. backend auth/CORS changes are minimal and sufficient.
7. web build, admin build, and targeted smoke checks all pass.
8. no unrelated cleanup or feature churn is introduced.
