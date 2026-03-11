# Prisma 7 Upgrade Guide

## Changes Made

### 1. Updated Dependencies
- `@prisma/client`: 6.0.0 → ^7.4.2
- `prisma`: 6.0.0 → ^7.4.2

### 2. Schema Changes
- Removed `url = env("DATABASE_URL")` from `prisma/schema.prisma`
- Created `prisma/prisma.config.ts` to handle datasource URL

### 3. Code Updates
- Updated `src/prisma/prisma.service.ts` to use prismaConfig
- Updated `prisma/seed.ts` to use prismaConfig
- Updated `prisma/seed-packages.ts` to use prismaConfig
- Updated `scripts/check-admin.ts` to use prismaConfig
- Updated `scripts/check-columns.ts` to use prismaConfig

### 4. Deploy Script
- Removed Prisma downgrade logic
- Added prisma.config.ts to deployment archive

## Next Steps

Run these commands locally:

```bash
cd be
yarn install
npx prisma generate
yarn build
```

Then deploy:

```bash
./deploy.sh
```

## References
- https://pris.ly/d/config-datasource
- https://pris.ly/d/prisma7-client-config
