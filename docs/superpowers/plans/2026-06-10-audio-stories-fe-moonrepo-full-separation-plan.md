# Audio Stories FE Moonrepo Full Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `fe/` from one Next.js app into a Moonrepo-managed monorepo with independent `web` and `admin` Next.js apps, shared packages, Yarn `4.15.0`, Node `24.16.0`, and minimal backend CORS/cookie support for subdomains.

**Architecture:** Use Full Separation: `fe/apps/web` owns public/user routes and PWA behavior, `fe/apps/admin` owns clean admin routes on a separate domain/subdomain, and `fe/packages/*` owns small shared utilities/UI/API helpers. Preserve current behavior first; extract shared code only where both apps demonstrably use it, and keep app-local code app-local to avoid cycles.

**Tech Stack:** Next.js `16.1.0`, React `19.2.3`, TypeScript, next-intl, Yarn Berry `4.15.0` with `nodeLinker: node-modules`, Moonrepo, Playwright, NestJS backend minimal CORS/cookie changes.

---

## 1. Scope, Invariants, And Responsibility Map

### Invariants
- `refresh_token` remains `HttpOnly`.
- refresh token is never stored in localStorage or response body.
- access token remains client-side Bearer token.
- web stays locale-prefixed.
- admin gets clean `/:lang/*` routes on admin domain.
- old admin URLs still redirect with query preservation.
- no DB migration.
- no mass dependency upgrades without evidence.

### High-risk call chains
1. `fe/src/middleware.ts` -> locale redirect + user auth + admin auth.
2. `fe/src/app/[lang]/layout.tsx` -> currently wraps both web and admin.
3. `be/src/auth/auth.controller.ts` -> set/clear refresh cookie.
4. `be/src/main.ts` -> single-frontend CORS allowlist.
5. `be/src/common/oauth-client.util.ts` -> OAuth redirect allowlist.
6. `fe/src/app/api/**` -> mixed web/admin local route handlers.

### Root-cause hypotheses to guard against
1. Cross-subdomain auth breaks because BE cookie/CORS still assumes one frontend.
   - Verify with login/refresh from both `3001` and `3002`.
2. Admin protection weakens because middleware only knows `/admin/*`.
   - Verify `/vi/users` redirects to `/vi/login?reason=unauthorized`.
3. Shared package extraction introduces cycles.
   - Verify packages never import `apps/*`; only apps import packages.
4. File movement breaks route handlers/import aliases.
   - Verify both app builds and local API routes.

### Impact analysis
- Auth/CORS changes affect login, refresh, logout, OAuth, verify-email redirects.
- Middleware changes affect every page request.
- Yarn/Moon changes affect all FE installs/builds.
- Route movement affects imports, assets, next-intl, PWA, UploadThing.
- Protection: targeted tests, staged commits, final rollback path by app.

---

## 2. Files To Create Or Modify

### FE root
- Modify: `fe/package.json`
- Create: `fe/.yarnrc.yml`
- Create: `fe/.nvmrc`
- Create: `fe/.moon/workspace.yml`
- Create: `fe/.moon/toolchain.yml`
- Create: `fe/.moon/tasks.yml`
- Create: `fe/tsconfig.base.json`
- Create: `fe/.env.example`
- Create/modify: `fe/yarn.lock`

### FE apps
- Create: `fe/apps/web/**`
- Create: `fe/apps/admin/**`
- Modify: `fe/playwright.config.ts`
- Move/split: `fe/e2e/web/**`, `fe/e2e/admin/**`, `fe/e2e/api/**`

### FE packages
- Create: `fe/packages/shared/**`
- Create: `fe/packages/ui/**`
- Create: `fe/packages/api-client/**`

### BE minimal changes
- Create: `be/src/common/origin.util.ts`
- Create: `be/src/auth/refresh-cookie.options.ts`
- Modify: `be/src/main.ts`
- Modify: `be/src/common/oauth-client.util.ts`
- Modify: `be/src/auth/auth.controller.ts`
- Create/modify: `be/.env.example`
- Create tests: `be/src/common/origin.util.spec.ts`, `be/src/auth/refresh-cookie.options.spec.ts`

---

## 3. Reproduce Plan / Verification Matrix

### Baseline reproduce before refactor
- [ ] Run current FE on `3001`, BE on `3000`.
- [ ] Verify `GET /` redirects to locale path.
- [ ] Verify `GET /vi/admin/login` renders login.
- [ ] Verify unauthenticated `GET /vi/admin/users` redirects to `/vi/admin/login?reason=unauthorized`.
- [ ] Verify `POST /auth/login` sets `refresh_token` cookie.
- [ ] Verify `POST /auth/logout` currently appears suspicious because clear path differs from set path.

### Post-implementation verification
- [ ] `node -v` => `v24.16.0`
- [ ] `yarn --version` => `4.15.0`
- [ ] `cd fe && yarn install --immutable`
- [ ] `cd fe && yarn moon query projects --json`
- [ ] `cd fe && yarn moon run shared:typecheck ui:typecheck apiClient:typecheck web:typecheck admin:typecheck web:build admin:build`
- [ ] `cd be && npm test -- origin.util.spec.ts refresh-cookie.options.spec.ts --runInBand && npm run build`
- [ ] web smoke: `/`, `/vi/story`, `/vi/music`, `/vi/profile`
- [ ] admin smoke: `/admin`, `/vi/admin`, `/vi/admin/login?reason=unauthorized`, `/vi/users`
- [ ] auth smoke: web login/refresh/logout and admin login/refresh/logout

---

## 4. Phase Plan

### Phase 0 — Baseline capture
**Files:** docs only

- [ ] `git status --short`
- [ ] `find fe/src/app -maxdepth 5 -type d | sort > /tmp/audio-stories-fe-routes-before.txt`
- [ ] Save baseline notes to `docs/superpowers/repro/2026-06-10-fe-full-separation-baseline.md`
- [ ] Commit:
```bash
git add docs/superpowers/repro/2026-06-10-fe-full-separation-baseline.md
git commit -m "docs: capture FE split baseline smoke matrix"
```

### Phase 1 — Bootstrap Yarn 4 + Moonrepo
**Files:** `fe/package.json`, `fe/.yarnrc.yml`, `fe/.nvmrc`, `fe/.moon/*`, `fe/tsconfig.base.json`, `fe/.env.example`

- [ ] Replace `fe/package.json` with root workspace manifest containing:
```json
{
  "name": "audio-stories-fe",
  "private": true,
  "packageManager": "yarn@4.15.0",
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": "24.16.0" }
}
```
- [ ] Create `fe/.yarnrc.yml`:
```yml
nodeLinker: node-modules
enableGlobalCache: true
```
- [ ] Create `fe/.nvmrc` => `v24.16.0`
- [ ] Create `fe/.moon/workspace.yml`:
```yml
projects:
  web: 'apps/web'
  admin: 'apps/admin'
  shared: 'packages/shared'
  ui: 'packages/ui'
  apiClient: 'packages/api-client'
```
- [ ] Create `fe/.moon/toolchain.yml`:
```yml
node:
  version: '24.16.0'
  packageManager: 'yarn'
  yarn:
    version: '4.15.0'
```
- [ ] Create `fe/.moon/tasks.yml` with default `lint`, `typecheck`, `build`
- [ ] Create `fe/tsconfig.base.json`
- [ ] Create `fe/.env.example` with approved FE env keys
- [ ] Verify:
```bash
cd fe
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('tsconfig.base.json','utf8')); console.log('json ok')"
```
- [ ] Commit:
```bash
git add fe/package.json fe/.yarnrc.yml fe/.nvmrc fe/.moon fe/tsconfig.base.json fe/.env.example
git commit -m "build(fe): bootstrap yarn moon workspace"
```

### Phase 2 — Create package skeletons
**Files:** `fe/packages/shared/**`, `fe/packages/ui/**`, `fe/packages/api-client/**`

- [ ] Create `@audio-stories/shared` exports for `auth`, `i18n`, `middleware`, `env`
- [ ] Create `@audio-stories/ui` empty shell first
- [ ] Create `@audio-stories/api-client` minimal shell first
- [ ] Shared package must contain:
  - `locales`, `defaultLocale`, `localeCookieName`, `isValidLocale`
  - `ACCESS_TOKEN_KEY`, `REFRESH_TOKEN_COOKIE`, `AUTH_LOGIN_PATH`, `AUTH_HOME_PATH`, `AUTH_PROTECTED_PREFIXES`
  - middleware helpers: `shouldSkipMiddlewarePath`, `detectLocaleFromHeaders`, `getLocaleFromRequest`, `stripLocale`
- [ ] Verify with:
```bash
cd fe
yarn moon run shared:typecheck ui:typecheck apiClient:typecheck
```
- [ ] Commit:
```bash
git add fe/packages
git commit -m "feat(fe): add shared workspace packages"
```

### Phase 3 — Create app skeletons
**Files:** `fe/apps/web/**`, `fe/apps/admin/**`

- [ ] Create `fe/apps/web/package.json`, `moon.yml`, `tsconfig.json`, `.env.example`
- [ ] Create `fe/apps/admin/package.json`, `moon.yml`, `tsconfig.json`, `.env.example`
- [ ] Both apps must set workspace deps:
```json
{
  "@audio-stories/shared": "workspace:*",
  "@audio-stories/ui": "workspace:*",
  "@audio-stories/api-client": "workspace:*"
}
```
- [ ] Web keeps current frontend dependencies including PWA.
- [ ] Admin excludes PWA dependency unless real code proves it is required.
- [ ] Commit:
```bash
git add fe/apps/web fe/apps/admin
git commit -m "feat(fe): add web and admin app skeletons"
```

### Phase 4 — Minimal BE support for split frontend
**Files:** `be/src/common/origin.util.ts`, `be/src/auth/refresh-cookie.options.ts`, `be/src/main.ts`, `be/src/common/oauth-client.util.ts`, `be/src/auth/auth.controller.ts`, `be/.env.example`

- [ ] Create `collectAllowedOrigins(env)` helper that reads `WEB_ORIGIN`, `ADMIN_ORIGIN`, `FRONTEND_URL`, `CLIENT_URL`, `CORS`, `ALLOWED_CLIENT_URLS`.
- [ ] Create tests for helper.
- [ ] Create `getRefreshCookieOptions()` and `getRefreshCookieClearOptions()`.
- [ ] Tests must verify:
  - development defaults `secure: false`, `sameSite: 'lax'`, `path: '/'`
  - production can use `COOKIE_DOMAIN=.example.com`, `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`
  - clear options match set options except `maxAge`
- [ ] Modify `be/src/main.ts` to use `collectAllowedOrigins(process.env)`.
- [ ] Modify OAuth util to include new origins while keeping legacy env compatibility.
- [ ] Modify auth controller so set/clear both use shared cookie options.
- [ ] Update `be/.env.example` with:
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
- [ ] Verify:
```bash
cd be
npm test -- origin.util.spec.ts refresh-cookie.options.spec.ts --runInBand
npm run build
```
- [ ] Commit:
```bash
git add be/src/common/origin.util.ts be/src/common/origin.util.spec.ts be/src/auth/refresh-cookie.options.ts be/src/auth/refresh-cookie.options.spec.ts be/src/main.ts be/src/common/oauth-client.util.ts be/src/auth/auth.controller.ts be/.env.example
git commit -m "fix(be): support split frontend origins and refresh cookies"
```

### Phase 5 — Web app migration
**Files:** `fe/apps/web/**`

- [ ] Copy source baseline:
```bash
mkdir -p fe/apps/web/src
rsync -a fe/src/ fe/apps/web/src/
[ -d fe/public ] && rsync -a fe/public/ fe/apps/web/public/ || true
[ -d fe/messages ] && rsync -a fe/messages/ fe/apps/web/messages/ || true
cp fe/next.config.ts fe/apps/web/next.config.ts
```
- [ ] Remove admin-owned code from web copy:
```bash
rm -rf fe/apps/web/src/app/'[lang]'/admin
rm -rf fe/apps/web/src/components/admin
rm -rf fe/apps/web/src/app/api/chapter-audio
rm -rf fe/apps/web/src/app/api/chapter-thumbnail
```
- [ ] Update `fe/apps/web/next.config.ts`:
  - keep PWA
  - keep current public redirects
  - add `transpilePackages: ['@audio-stories/shared', '@audio-stories/ui', '@audio-stories/api-client']`
  - add `outputFileTracingRoot: path.join(__dirname, '../..')`
- [ ] Replace middleware with web-only middleware using `@audio-stories/shared/*`.
- [ ] Web middleware responsibilities:
  - skip static/internal paths
  - add locale if missing
  - protect user paths only
  - redirect authenticated users away from auth pages where current behavior requires
  - set `NEXT_LOCALE`
  - contain **no** admin logic
- [ ] Verify:
```bash
cd fe
yarn moon run web:typecheck
yarn moon run web:build
```
- [ ] Commit:
```bash
git add fe/apps/web fe/packages
git commit -m "feat(fe): migrate web app"
```

### Phase 6 — Admin app migration
**Files:** `fe/apps/admin/**`

- [ ] Copy clean admin route tree:
```bash
rsync -a fe/src/app/'[lang]'/admin/ fe/apps/admin/src/app/'[lang]'/
```
- [ ] Copy admin support folders needed for first passing build.
- [ ] Copy admin-owned API handlers:
```bash
rsync -a fe/src/app/api/chapter-audio fe/apps/admin/src/app/api/
rsync -a fe/src/app/api/chapter-thumbnail fe/apps/admin/src/app/api/
```
- [ ] Create admin `next.config.ts` without PWA.
- [ ] Add compatibility redirects:
```ts
[
  { source: '/admin', destination: '/vi', permanent: false },
  { source: '/:lang(vi|en)/admin', destination: '/:lang', permanent: false },
  { source: '/:lang(vi|en)/admin/login', destination: '/:lang/login', permanent: false },
  { source: '/:lang(vi|en)/admin/:path*', destination: '/:lang/:path*', permanent: false }
]
```
- [ ] Create admin middleware responsibilities:
  - skip static/internal paths
  - redirect old `/admin` patterns to clean paths preserving query
  - add locale if missing
  - allow `/:lang/login`
  - protect all other localized routes via `refresh_token`
  - set `NEXT_LOCALE`
- [ ] Audit hardcoded frontend `/admin` links in admin app:
```bash
grep -RIn "/admin" fe/apps/admin/src | tee /tmp/audio-stories-admin-paths.txt
```
- [ ] Replace frontend navigation paths only; do **not** alter backend REST endpoints that legitimately include `/admin`.
- [ ] Verify:
```bash
cd fe
yarn moon run admin:typecheck
yarn moon run admin:build
```
- [ ] Commit:
```bash
git add fe/apps/admin fe/packages
git commit -m "feat(fe): migrate admin app"
```

### Phase 7 — Install and compatibility gate
**Files:** `fe/yarn.lock`, possible targeted package manifest changes only if errors demand it

- [ ] Verify toolchain:
```bash
cd fe
node -v
corepack enable
yarn set version 4.15.0
yarn --version
```
- [ ] Install:
```bash
cd fe
yarn install
yarn install --immutable
```
- [ ] If install/build fails, only upgrade the package that causes a real peer/engine incompatibility.
- [ ] Expected likely targeted upgrade: `@types/node` from `^20` to `^24`.
- [ ] Verify Moon project registry:
```bash
cd fe
yarn moon query projects --json | tee /tmp/audio-stories-moon-projects.json
grep -E '"(web|admin|shared|ui|apiClient)"' /tmp/audio-stories-moon-projects.json
```
- [ ] Commit lockfile/tool metadata:
```bash
git add fe/package.json fe/yarn.lock fe/.yarnrc.yml fe/.moon fe/.nvmrc fe/.yarn/releases 2>/dev/null || git add fe/package.json fe/yarn.lock fe/.yarnrc.yml fe/.moon fe/.nvmrc

git commit -m "build(fe): generate yarn 4 workspace lockfile"
```

### Phase 8 — E2E split
**Files:** `fe/playwright.config.ts`, `fe/e2e/**`

- [ ] Create directories:
```bash
mkdir -p fe/e2e/web fe/e2e/admin fe/e2e/api
```
- [ ] Move tests by concern:
  - web: `seo`, `user-flow`, `ui-notifications`
  - admin: `admin-flow`
  - api: `security`, `api-notifications`
- [ ] Replace `fe/playwright.config.ts` with projects:
  - `web` => baseURL `WEB_URL` default `http://localhost:3001`
  - `admin` => baseURL `ADMIN_URL` default `http://localhost:3002`
  - `api` => baseURL `BE_URL` default `http://localhost:3000`
- [ ] Add `fe/e2e/admin/admin-redirects.spec.ts` covering:
  - `/admin -> /vi`
  - `/en/admin -> /en`
  - `/vi/admin/login?reason=unauthorized -> /vi/login?reason=unauthorized`
  - unauthenticated `/vi/users -> /vi/login?reason=unauthorized`
- [ ] Verify:
```bash
cd fe
WEB_URL=http://localhost:3001 ADMIN_URL=http://localhost:3002 BE_URL=http://localhost:3000 yarn test:e2e:admin
```
- [ ] Commit:
```bash
git add fe/playwright.config.ts fe/e2e
git commit -m "test(fe): split e2e projects for web admin api"
```

### Phase 9 — Final cleanup
**Files:** remove old single-app leftovers only after both builds pass

- [ ] Pre-cleanup gate:
```bash
cd fe
yarn moon run shared:typecheck ui:typecheck apiClient:typecheck web:typecheck admin:typecheck web:build admin:build
```
- [ ] Remove legacy source:
```bash
rm -rf fe/src
rm -f fe/next.config.ts
```
- [ ] Verify again:
```bash
cd fe
yarn moon run web:build admin:build
```
- [ ] Commit:
```bash
git add -A fe
git commit -m "refactor(fe): remove legacy single app source"
```

### Phase 10 — Runtime verification, rollout, rollback
**Files:** docs/deploy config only if repo contains them

- [ ] Start backend:
```bash
cd be
WEB_ORIGIN=http://localhost:3001 ADMIN_ORIGIN=http://localhost:3002 CORS=http://localhost:3001,http://localhost:3002 COOKIE_DOMAIN= COOKIE_SAME_SITE=lax COOKIE_SECURE=false npm run start:dev
```
- [ ] Start FE apps:
```bash
cd fe && yarn dev:web
cd fe && yarn dev:admin
```
- [ ] Smoke routes:
```bash
curl -I http://localhost:3001/
curl -I http://localhost:3001/vi/story
curl -I http://localhost:3002/admin
curl -I 'http://localhost:3002/vi/admin/login?reason=unauthorized'
curl -I http://localhost:3002/vi/users
```
- [ ] Deploy order:
  1. backend support
  2. web app
  3. admin app
  4. DNS/proxy cutover
  5. monitor 401/CORS/upload/assets
- [ ] Rollback:
  - web rollback independent
  - admin rollback independent
  - backend rollback by reverting origin/cookie config and code
  - no DB rollback needed

---

## 5. Minimal Upgrade Strategy

### Default stance
- Keep current FE package versions unless install/build/peer issues prove otherwise.
- Do not broad-upgrade Next/React during this split.

### Evidence-backed compatibility checks
- [ ] `yarn install`
- [ ] `yarn install --immutable`
- [ ] `yarn moon run web:build admin:build`
- [ ] inspect peer warnings from Yarn output

### Likely targeted changes
- `@types/node` -> Node 24 compatible major (`^24`)
- Add package-local dependencies if Yarn Berry surfaces hidden root dependency assumptions.
- Add `next` as peer/dev dependency in shared package only if type imports from `next/server` require it.

---

## 6. Design Approval Gate Before Execution

Execution should start only after all of the following are true:
- [ ] User confirms this implementation plan.
- [ ] No unresolved ambiguity remains about route ownership or deployment topology.
- [ ] FE root can be converted to workspace without overwriting unrelated user changes.
- [ ] Backend env update is acceptable for the target deployment pipeline.
- [ ] Team agrees that old admin URL compatibility redirects are required in admin app.

---

## 7. Self-Review

### Spec coverage check
- Full separation with Moonrepo: covered in Phases 1–3.
- Node `24.16.0` / Yarn `4.15.0`: covered in Phases 1 and 7.
- Shared packages and ownership: covered in Phases 2, 5, 6.
- Auth/cookie/CORS minimal BE changes: covered in Phase 4.
- Web/admin route split and admin compatibility redirects: covered in Phases 5 and 6.
- `.env.example` updates: covered in Phases 1 and 4.
- E2E split: covered in Phase 8.
- Verification/rollout/rollback: covered in Phases 10 and verification matrix.

### Placeholder scan
- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Commands, file paths, and expected checks are concrete.

### Consistency check
- Workspace project names are consistent: `web`, `admin`, `shared`, `ui`, `apiClient`.
- Route contract is consistent with approved design.
- Cookie/CORS env names are consistent with approved design.
