# Audio Stories BE — Local Dev

## 1. Runtime roles

Backend now supports 3 explicit roles from the same codebase:

- `api` → Nest HTTP server. Owns REST endpoints, middleware, CORS, cookies. `yarn api:dev` runs Prisma migrations first, then starts watch mode.
- `worker` → standalone Nest application context. No HTTP listener. No cron ownership. Current codebase has no dedicated queue consumer yet; this role exists to keep runtime separation stable for future async jobs.
- `scheduler` → standalone Nest application context. No HTTP listener. Owns cron jobs from `tracking`, `memberships`, `user-features`.

Invariant: cron must run only in `scheduler`; HTTP must run only in `api`.

## 2. Required versions

- Node.js `24.16.0`
- Yarn `4.15.0`
- `.nvmrc` pin: `v24.16.0`
- MySQL `8.x` (or compatible MySQL server)
- Redis `7.x`

Enable the pinned Yarn version with Corepack:

```bash
corepack enable
corepack prepare yarn@4.15.0 --activate
```

## 3. Install deps

```bash
cd be
yarn install --immutable
```

> Repo now includes `packageManager: yarn@4.15.0` and `.yarnrc.yml` with `nodeLinker: node-modules` so Yarn v4 behaves like a standard Node/Nest workspace.

## 4. Configure `.env`

```bash
cp .env.example .env
```

Important groups inside `.env.example`:

- runtime: `APP_ROLE`, `NODE_ENV`, `HOST`, `PORT`
- CORS/cookies: `WEB_ORIGIN`, `ADMIN_ORIGIN`, `FRONTEND_URL`, `CLIENT_URL`, `ALLOWED_CLIENT_URLS`, `CORS`, `COOKIE_*`
- database/cache: `DATABASE_URL`, `REDIS_URL` (+ split Redis fields)
- auth: `JWT_*`, `INTERNAL_API_KEY`
- mail/OAuth/upload/payment: `SMTP_*`, `GOOGLE_*`, `R2_*`, `UPLOADTHING_TOKEN`, `STRIPE_*`, `VIETQR_*`, `CASSO_*`
- bootstrap/test helpers: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TEST_*`, `E2E_CLEANUP`

Compatibility aliases still accepted by code:

- `MAIL_FROM` → legacy alias for `SMTP_FROM`
- `VIETQR_DEFAULT_TEMPLATE` → legacy alias for `VIETQR_TEMPLATE`
- `VIETQR_ACQ_ID` → legacy alias for `VIETQR_BANK_ID`
- `R2_SECRET_KEY_ID` → legacy alias for `R2_SECRET_ACCESS_KEY`

## 5. Local MySQL setup

### Option A — Docker (recommended)

```bash
docker run --name audio-stories-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=audio_stories_dev \
  -p 3306:3306 \
  -d mysql:8.0
```

Use this `.env` value:

```env
DATABASE_URL=mysql://root:root@127.0.0.1:3306/audio_stories_dev
```

### Option B — existing local MySQL

Just make sure the database already exists and update `DATABASE_URL` accordingly.

Example:

```sql
CREATE DATABASE audio_stories_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 6. Local Redis setup

### Option A — Docker (recommended)

```bash
docker run --name audio-stories-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

Use this `.env` value:

```env
REDIS_URL=redis://127.0.0.1:6379/0
```

### Option B — existing local Redis

Update `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` to match your machine.

## 7. Prisma flow

Generate client once after install:

```bash
yarn prisma:generate
```

Create a new migration during schema development:

```bash
yarn prisma:migrate
```

Optional seed:

```bash
yarn prisma:seed
```

Important: `yarn api:dev` already runs `yarn prisma:migrate:deploy:safe` before starting the API watcher, so local DB schema is applied before the HTTP app boots.

## 8. Start local dev

Start the API first, then optional companion roles in separate terminals.

### Terminal 1 — API

```bash
yarn api:dev
```

What it does:

1. sets `APP_ROLE=api`
2. runs `yarn prisma:migrate:deploy:safe`
3. starts Nest watch mode

### Terminal 2 — Worker

```bash
yarn worker:dev
```

What it does:

1. sets `APP_ROLE=worker`
2. starts Nest watch mode as standalone application context
3. does **not** open an HTTP port
4. does **not** own cron jobs

### Terminal 3 — Scheduler

```bash
yarn scheduler:dev
```

What it does:

1. sets `APP_ROLE=scheduler`
2. starts Nest watch mode as standalone application context
3. owns cron jobs only
4. does **not** open an HTTP port

## 9. Useful scripts

```bash
yarn build
yarn test
yarn test:e2e
yarn prisma:generate
yarn prisma:migrate
yarn prisma:migrate:deploy:safe
yarn prisma:seed
```

## 10. Troubleshooting

- `P1001` / Prisma cannot connect → MySQL is not running or `DATABASE_URL` is wrong.
- `ECONNREFUSED 127.0.0.1:6379` → Redis is not running or `REDIS_URL` is wrong.
- CORS rejected → verify `WEB_ORIGIN`, `ADMIN_ORIGIN`, `FRONTEND_URL`, `CLIENT_URL`, `ALLOWED_CLIENT_URLS`, `CORS`.
- Upload/payment routes fail → check optional provider keys (`UPLOADTHING_TOKEN`, `R2_*`, `STRIPE_*`, `VIETQR_*`, `CASSO_*`).

## 11. Production note

- `deploy.sh` now enforces the same pinned toolchain on local deploy host and remote server: Node `v24.16.0` + Yarn `4.15.0` via Corepack.
- Deploy flow uses Yarn only: `yarn install --immutable` → `yarn prisma:generate` → `yarn prisma:migrate:deploy:safe` → `yarn build` → `pm2 startOrReload`.
- PM2/runtime separation must keep `api`, `worker`, `scheduler` as distinct processes. If you collapse back to one API-only process, cron jobs will stop because scheduler ownership is intentionally isolated now.
