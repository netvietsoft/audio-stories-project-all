# Audio Stories Remaining Critical Phases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close only the remaining phases that are still required to make the FE/BE refactor safe to ship, without expanding scope or introducing new risk.

**Architecture:** The monorepo split, Moonrepo wiring, BE CORS/cookie support, dual app build graph, and admin redirect flow are already implemented and verified. The only remaining mandatory work is to close one real auth correctness gap in the web app, then run the live auth/cookie/CORS matrix that is still unproven, and finally freeze the changeset so no split-app files are omitted from version control.

**Tech Stack:** Next.js 16.1.0, React 19.2.3, Yarn 4.15.0, Moonrepo, Playwright, Zustand, Axios, NestJS 11, cookie-parser, CORS.

---

## 1. Current State Audit

### Already completed and freshly verified
- FE workspace split into `fe/apps/web`, `fe/apps/admin`, `fe/packages/*`
- Moonrepo working with `fe/.moon/toolchain.yml`
- FE `yarn install --immutable` passes on Node `24.16.0` / Yarn `4.15.0`
- FE `shared/ui/apiClient/web/admin` typecheck passes
- FE `shared/ui/apiClient/web/admin` build graph passes
- Admin compatibility redirects pass via curl and Playwright
- BE split-origin helper tests and build pass
- `git diff --check` is clean

### Not yet proven enough for production confidence
1. **Web logout path is logically incomplete**
   - `fe/apps/web/src/components/layout/Navbar.tsx`
   - Current call chain:
     - user clicks logout
     - `handleLogout()` clears local Zustand state
     - `clearAuthCookies()` clears only JS-readable `access_token`
     - **no request hits `POST /auth/logout`**
   - Meanwhile the real refresh cookie stays HttpOnly and is only cleared by BE:
     - `be/src/auth/auth.controller.ts -> POST /auth/logout -> res.clearCookie('refresh_token', ...)`
   - Web API client still auto-refreshes on 401:
     - `fe/apps/web/src/lib/api/api-client.ts -> response interceptor -> POST /auth/refresh` with `withCredentials: true`
   - Result: logout can appear successful on web while the refresh cookie may still survive.

2. **Live split-domain auth/cookie/CORS flow is still only partially verified**
   - We verified static/build/admin redirect behavior.
   - We have **not** yet verified with a real login session that both web and admin can:
     - set `refresh_token`
     - rotate via `/auth/refresh`
     - clear via `/auth/logout`
     - behave correctly under cross-origin `Origin` headers

3. **Changeset is not yet finalized in git**
   - Many new split-app files are still untracked.
   - This is release-risk, not code-risk: the refactor can be locally correct but incomplete once pushed if files are omitted.

---

## 2. Scope Filter — What Is Actually Still Necessary

### Mandatory phases
- **Phase 11** — Web logout correctness fix + regression coverage
- **Phase 12** — Live auth/cookie/CORS verification matrix for web + admin
- **Phase 13** — VCS freeze / finalization gate

### Conditional phase
- **Phase 14** — Proxy/DNS/cutover rehearsal
  - Only needed if rollout is imminent and the infra config lives in or alongside this repo.

### Explicitly not necessary now
- No broad dependency upgrades beyond already-proven fixes
- No extra shared-package refactor
- No PWA/icon cleanup
- No database migration
- No BE auth redesign
- No extra admin route changes
- No broad web E2E expansion outside auth regression coverage

---

## 3. Root-Cause Analysis For The Remaining Mandatory Work

### Remaining bug / risk surface A — Web logout does not clear the real session

#### Responsibility map / call chain
- FE logout UI entrypoint:
  - `fe/apps/web/src/components/layout/Navbar.tsx`
- FE session state:
  - `fe/apps/web/src/stores/user-store.ts`
  - `fe/apps/web/src/lib/auth/cookies.ts`
- FE auto-refresh transport:
  - `fe/apps/web/src/lib/api/api-client.ts`
- BE refresh cookie clear path:
  - `be/src/auth/auth.controller.ts`
  - `be/src/auth/refresh-cookie.options.ts`

#### Hypothesis 1
**Root cause:** web logout never calls `POST /auth/logout`, so the HttpOnly `refresh_token` cookie survives.

**How to verify:**
1. Log in on web with a real test account.
2. Click logout from the mounted web navbar.
3. Inspect network tab or Playwright request events.
4. Expected current failure: no `POST /auth/logout` request is sent.

#### Hypothesis 2
**Root cause:** even if web starts calling `/auth/logout`, cookie clearing can still fail if live `COOKIE_DOMAIN`, `COOKIE_SAME_SITE`, or `COOKIE_SECURE` do not match the set-cookie path/domain used at login.

**How to verify:**
1. Capture `Set-Cookie` from `/auth/login`.
2. Capture `Set-Cookie` from `/auth/logout`.
3. Confirm `Path`, `Domain`, `SameSite`, `Secure` match the BE helper contract except `Max-Age`.
4. Re-hit `/auth/refresh` after logout and confirm it no longer succeeds.

#### Broken invariants
- “Logout must revoke/clear refresh session” is broken on web.
- “After logout, 401 must not silently re-authenticate” is at risk on web.
- “Web and admin use the same backend session semantics” is currently asymmetric.

### Remaining risk surface B — split-domain session flow still lacks live proof

#### Hypothesis 1
**Root cause:** local static checks passed, but one origin may still fail at runtime because `Origin`/cookie attributes differ between `3001` and `3002`.

**How to verify:**
- Run identical login/refresh/logout flow twice:
  - once with `Origin: http://localhost:3001`
  - once with `Origin: http://localhost:3002`

#### Hypothesis 2
**Root cause:** OAuth / redirect allowlists may be correct in code but wrong in deployment env.

**How to verify:**
- Confirm `WEB_ORIGIN`, `ADMIN_ORIGIN`, `CLIENT_URL`, `CORS`, `ALLOWED_CLIENT_URLS` are all set coherently in the actual runtime env before rollout.

---

## 4. Impact Analysis

### If we fix Phase 11 incorrectly
Possible side effects:
- web logout redirects but leaves local auth dirty
- web logout revokes token too early and breaks router transition
- web logout starts calling BE but swallows network failures incorrectly

Protection:
- keep fix scoped to mounted web logout path only
- do not alter BE contract
- do not change refresh interceptor behavior
- verify logout twice:
  - network request exists
  - refresh no longer works after logout

### If we skip Phase 12
Possible side effects:
- ship with correct code but wrong live cookie/CORS env
- admin works while web fails, or vice versa
- logout fix lands but real cookie domain still mismatches

Protection:
- require live matrix before “production-ready” claim
- capture exact request/response headers during verification

### If we skip Phase 13
Possible side effects:
- split FE files missing from git
- future verification impossible to reproduce from branch/PR
- reviewers see partial refactor only

Protection:
- stage all intended new files
- explicitly exclude artifacts (`node_modules`, `dist`, `playwright-report`, `test-results`)
- review cached diff before final commit

---

## 5. Remaining Phase Plan

### Phase 11 — Web logout correctness hardening

**Files:**
- Modify: `fe/apps/web/src/components/layout/Navbar.tsx`
- Verify against: `fe/apps/web/src/lib/api/api-client.ts`
- Verify against: `be/src/auth/auth.controller.ts`
- Create or modify test: `fe/e2e/web/auth-session.spec.ts` **or** extend `fe/e2e/web/user-flow.spec.ts`

- [ ] Confirm the mounted logout handler is the web navbar path in:
  - `fe/apps/web/src/app/[lang]/(main)/layout.tsx`
  - `fe/apps/web/src/app/[lang]/music/layout.tsx`

- [ ] Change only the web logout action so user-initiated logout hits backend before local cleanup.
  - Required target behavior:

```ts
const handleLogout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error('Backend logout failed:', error);
  } finally {
    useUserStore.getState().clearAuth();
    clearAuthCookies();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    closeMobileMenu();
    router.push(`/${currentLang}`);
    router.refresh();
  }
};
```

- [ ] Do **not** change the 401 cleanup path in `AuthProvider` during this phase.
  - That path is local session cleanup, not explicit user logout.

- [ ] Add regression coverage using existing Playwright style.
  - Preferred file: `fe/e2e/web/auth-session.spec.ts`
  - Gate with env vars already consistent with repo style:
    - `TEST_USER_EMAIL`
    - `TEST_USER_PASSWORD`
  - Minimum assertions:
    1. login succeeds
    2. logout triggers backend `/auth/logout`
    3. subsequent protected API call does **not** silently refresh using old cookie

- [ ] Verify Phase 11 narrowly:
```bash
cd fe
PLAYWRIGHT_CHANNEL=chrome WEB_URL=http://localhost:3001 BE_URL=http://localhost:3000 yarn playwright test e2e/web/auth-session.spec.ts --project=web
```

- [ ] Commit Phase 11:
```bash
git add fe/apps/web/src/components/layout/Navbar.tsx fe/e2e/web/auth-session.spec.ts
git commit -m "fix(fe): clear backend refresh session on web logout"
```

### Phase 12 — Live auth/cookie/CORS verification matrix

**Files:**
- No code required unless verification reveals a real defect
- Inputs: `be/.env.example`, `fe/apps/web/.env.example`, `fe/apps/admin/.env.example`

- [ ] Start BE with split-origin local env:
```bash
cd be
WEB_ORIGIN=http://localhost:3001 \
ADMIN_ORIGIN=http://localhost:3002 \
FRONTEND_URL=http://localhost:3001 \
CLIENT_URL=http://localhost:3001 \
ALLOWED_CLIENT_URLS=http://localhost:3001,http://localhost:3002 \
CORS=http://localhost:3001,http://localhost:3002 \
COOKIE_DOMAIN= \
COOKIE_SAME_SITE=lax \
COOKIE_SECURE=false \
npm run start:dev
```

- [ ] Start FE apps:
```bash
cd fe && yarn moon run web:start
cd fe && yarn moon run admin:start
```

- [ ] Run direct BE cookie matrix from **web origin** using a real test account:
```bash
WEB_EMAIL='<test-email>'
WEB_PASSWORD='<test-password>'

curl -i -c /tmp/audio-web.cookies -b /tmp/audio-web.cookies \
  -H 'Origin: http://localhost:3001' \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$WEB_EMAIL\",\"password\":\"$WEB_PASSWORD\"}" \
  http://localhost:3000/auth/login

curl -i -c /tmp/audio-web.cookies -b /tmp/audio-web.cookies \
  -H 'Origin: http://localhost:3001' \
  -X POST http://localhost:3000/auth/refresh
```

- [ ] Run the same direct BE cookie matrix from **admin origin**:
```bash
ADMIN_EMAIL='<test-email>'
ADMIN_PASSWORD='<test-password>'

curl -i -c /tmp/audio-admin.cookies -b /tmp/audio-admin.cookies \
  -H 'Origin: http://localhost:3002' \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  http://localhost:3000/auth/login

curl -i -c /tmp/audio-admin.cookies -b /tmp/audio-admin.cookies \
  -H 'Origin: http://localhost:3002' \
  -X POST http://localhost:3000/auth/refresh
```

- [ ] Verify explicit logout clear from both origins.
  - Capture login `Set-Cookie`
  - Capture logout `Set-Cookie`
  - Confirm post-logout `/auth/refresh` no longer succeeds

- [ ] Run browser-level smoke after Phase 11 lands:
```bash
cd fe
PLAYWRIGHT_CHANNEL=chrome WEB_URL=http://localhost:3001 ADMIN_URL=http://localhost:3002 BE_URL=http://localhost:3000 yarn test:e2e:web
PLAYWRIGHT_CHANNEL=chrome WEB_URL=http://localhost:3001 ADMIN_URL=http://localhost:3002 BE_URL=http://localhost:3000 yarn test:e2e:admin
```

- [ ] Negative CORS gate in production-like mode:
```bash
curl -i -H 'Origin: http://evil.local' http://localhost:3000/auth/me
```
Expected: not allowed by CORS when prod-like origin restrictions are active.

- [ ] If Phase 12 reveals a real defect, open a **new** fix phase. Do not bundle speculative code changes into this verification phase.

### Phase 13 — VCS freeze and finalization gate

**Files:**
- Stage: all intended `fe/apps/**`, `fe/packages/**`, `fe/e2e/**`, `fe/.moon/**`, `fe/.yarnrc.yml`, `fe/package.json`, `fe/yarn.lock`, `be/**`, docs
- Exclude: `node_modules`, `dist`, `.next`, `playwright-report`, `test-results`

- [ ] List untracked files and confirm they are intentional split-app sources:
```bash
git ls-files --others --exclude-standard
```

- [ ] Stage only intended files:
```bash
git add be fe docs
```

- [ ] Confirm no artifacts are staged:
```bash
git diff --cached --name-only | grep -E 'node_modules|/dist/|playwright-report|test-results|\.next' && echo 'UNEXPECTED ARTIFACT' || echo 'artifact check clean'
```

- [ ] Re-run final gated checks from staged tree:
```bash
cd fe && yarn install --immutable
cd fe && yarn moon run shared:typecheck ui:typecheck apiClient:typecheck web:typecheck admin:typecheck shared:build ui:build apiClient:build web:build admin:build
cd be && npm test -- origin.util.spec.ts refresh-cookie.options.spec.ts --runInBand && npm run build
cd /home/thehiep/Documents/Dev-TheHiep/NetViet-Projects/audio-stories-project-all && git diff --check
```

- [ ] Review cached diff before final commit:
```bash
git diff --cached --stat
git diff --cached -- docs/superpowers/specs/2026-06-10-audio-stories-fe-moonrepo-full-separation-design.md
git diff --cached -- docs/superpowers/plans/2026-06-10-audio-stories-fe-moonrepo-full-separation-plan.md
git diff --cached -- fe/.moon/tasks.yml fe/.moon/toolchain.yml fe/deploy.sh fe/ecosystem.config.js fe/playwright.config.ts
```

- [ ] Commit final integrated result:
```bash
git commit -m "refactor(fe): finalize full-separation monorepo rollout"
```

### Phase 14 — Conditional rollout rehearsal (only if deployment is imminent)

**Files:**
- Review only: `fe/deploy.sh`, `fe/ecosystem.config.js`, `be/deploy.sh`, `be/ecosystem.config.js`
- External infra may also be required, but only if managed by the team right now

- [ ] Confirm actual deployed env has:
  - `WEB_ORIGIN`
  - `ADMIN_ORIGIN`
  - `CORS`
  - `ALLOWED_CLIENT_URLS`
  - `COOKIE_DOMAIN`
  - `COOKIE_SAME_SITE`
  - `COOKIE_SECURE`

- [ ] Confirm web/admin reverse proxy target ports align with FE PM2 config:
  - web -> `3058`
  - admin -> `3059`

- [ ] If proxy/DNS/cert config is **not** stored in this repo, do not invent a repo change. Produce an external cutover checklist only.

---

## 6. Verification Exit Criteria

This refactor is safe to call production-ready only when all of the following are true:
- [ ] Phase 11 web logout sends backend logout request and no longer leaves refresh session alive
- [ ] Phase 12 proves login/refresh/logout from both web and admin origins
- [ ] Phase 12 proves negative CORS behavior in restricted mode
- [ ] Phase 13 stages all intended split files and no artifacts
- [ ] FE and BE verification commands still pass after final staging

---

## 7. Decision Summary

### Remaining phases that are truly necessary
1. **Phase 11** — mandatory code fix
2. **Phase 12** — mandatory live verification gate
3. **Phase 13** — mandatory VCS/release gate

### Remaining phase that is only conditionally necessary
4. **Phase 14** — only if rollout/cutover starts now

### Everything else
Defer. Not required for correctness or safe handoff.
