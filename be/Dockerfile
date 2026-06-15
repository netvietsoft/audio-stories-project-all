# syntax=docker/dockerfile:1.7

# ---------- deps: full install (devDeps included) for the build stage ----------
FROM node:24.16.0-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare yarn@4.15.0 --activate
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install --immutable

# ---------- build: compile TypeScript, generate Prisma client, emit OpenAPI ----------
FROM node:24.16.0-slim AS build
WORKDIR /app
# Install openssl BEFORE `yarn prisma:generate` so Prisma detects the host
# libssl version (3.0.x on Debian Bookworm slim) and downloads the matching
# query engine binary. Without this, Prisma emits a warning, defaults to
# openssl-1.1.x, and the resulting client crashes at runtime with
# PrismaClientInitializationError ("Query Engine for debian-openssl-3.0.x").
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare yarn@4.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY --from=deps /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY scripts ./scripts
RUN yarn prisma:generate
RUN yarn build
# NOTE: `yarn openapi` is intentionally OMITTED from the image build.
# That script (scripts/generate-openapi.ts) instantiates the full AppModule,
# which boots CacheModule -> redisStore({ url }) and tries to connect to
# Redis during construction. Inside the build container there is no Redis,
# so the connection hangs and the process is terminated by the redis client
# without a recoverable error. Swagger UI at /docs still works at runtime —
# buildSwaggerDocument(app) is invoked inside bootstrap.ts and serves the
# document live; dist/openapi.json is only a CI/tooling artifact, not a
# runtime dependency (no reference to the file from src/). CI generates it
# separately when needed.

# ---------- prod-deps: production-only node_modules (yarn 4 idiomatic prune) ----------
FROM node:24.16.0-slim AS prod-deps
WORKDIR /app
RUN corepack enable && corepack prepare yarn@4.15.0 --activate
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn workspaces focus --all --production

# ---------- runtime: minimal image, non-root, dumb-init as PID 1 ----------
FROM node:24.16.0-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nestjs

# Production-only deps from prod-deps stage...
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
# ...overlaid with the Prisma client generated in the build stage (devDep `prisma`
# CLI emits into node_modules/.prisma/client and node_modules/@prisma/client).
COPY --from=build --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nestjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json

# Pre-create writable uploads/ owned by the runtime user. bootstrap.ts does
# `fs.mkdirSync(join(process.cwd(), 'uploads'), { recursive: true })` at boot
# (for static-serving local uploads), which would fail with EACCES under the
# non-root user against a root-owned WORKDIR. In production this directory is
# typically a mounted volume; pre-creating it makes the boot path safe whether
# or not a volume is mounted.
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

# dumb-init reaps zombies and forwards signals to node (defense-in-depth on top
# of the explicit SIGTERM/SIGINT handlers added in be/src/bootstrap.ts, Task 9).
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
