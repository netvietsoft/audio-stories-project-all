#!/usr/bin/env node

const { execSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

const LEGACY_MIGRATION_NAME = "20260413000001_add_music_history_progress_seconds";
const TARGET_TABLE = "music_history";
const TARGET_COLUMN = "progress_seconds";

const prisma = new PrismaClient();

function toCount(value) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
  `;

  return toCount(rows?.[0]?.count) > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `;

  return toCount(rows?.[0]?.count) > 0;
}

async function migrationApplied(migrationName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM _prisma_migrations
    WHERE migration_name = ${migrationName}
      AND finished_at IS NOT NULL
  `;

  return toCount(rows?.[0]?.count) > 0;
}

async function resolveLegacyMigrationIfNeeded() {
  const [hasPrismaMigrationsTable, hasTargetColumn] = await Promise.all([
    tableExists("_prisma_migrations"),
    columnExists(TARGET_TABLE, TARGET_COLUMN),
  ]);

  if (!hasTargetColumn) {
    console.log("[prisma-safe-migrate] No legacy resolve needed: target column does not exist.");
    return;
  }

  if (!hasPrismaMigrationsTable) {
    console.log("[prisma-safe-migrate] Skipping legacy resolve: _prisma_migrations table not found yet.");
    return;
  }

  const isApplied = await migrationApplied(LEGACY_MIGRATION_NAME);
  if (isApplied) {
    console.log("[prisma-safe-migrate] Legacy migration already marked as applied.");
    return;
  }

  console.log(
    `[prisma-safe-migrate] Resolving ${LEGACY_MIGRATION_NAME} as applied because ${TARGET_TABLE}.${TARGET_COLUMN} already exists.`,
  );
  execSync(`npx prisma migrate resolve --applied ${LEGACY_MIGRATION_NAME}`, {
    stdio: "inherit",
  });
}

async function main() {
  try {
    await resolveLegacyMigrationIfNeeded();
  } finally {
    await prisma.$disconnect();
  }

  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

main().catch((error) => {
  console.error("[prisma-safe-migrate] Failed:", error);
  process.exit(1);
});
