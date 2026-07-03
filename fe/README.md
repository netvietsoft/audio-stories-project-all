# Audio Stories FE — Local Dev + Deploy Toolchain

## Toolchain standard

Frontend workspace is standardized on:

- Node.js `24.16.0`
- Yarn `4.15.0`
- Moonrepo for workspace task orchestration

Pinned files:

- `.nvmrc` → `v24.16.0`
- `package.json` → `packageManager: yarn@4.15.0`
- `.moon/toolchain.yml` → Node/Yarn toolchain pin
- `.yarnrc.yml` → `nodeLinker: node-modules`

## Local dev setup

```bash
cd fe
corepack enable
corepack prepare yarn@4.15.0 --activate
yarn install --immutable
```

Verify toolchain:

```bash
node -v   # v24.16.0
yarn -v   # 4.15.0
```

## Local dev commands

```bash
yarn dev:web
yarn dev:admin
yarn build
yarn typecheck
yarn lint
yarn test:e2e
```

## Deploy standard

`fe/deploy.sh` now enforces the same pinned toolchain on both:

- local packaging host
- remote deployment server

Deploy flow:

1. verifies Node `v24.16.0`
2. enables Corepack
3. activates Yarn `4.15.0`
4. runs `yarn install --immutable`
5. runs `yarn build`
6. reloads PM2 apps

If either local machine or remote server is not on the pinned Node/Yarn versions, deploy stops early instead of silently building with a drifted package manager.
