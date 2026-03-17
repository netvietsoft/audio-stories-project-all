/*
  Warnings:

  - You are about to drop the column `name_en` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `name_vi` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `audio_url_en` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `audio_url_vi` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `content_en` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `content_vi` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `description_en` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `description_vi` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `title_en` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `title_vi` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `description_en` on the `stories` table. All the data in the column will be lost.
  - You are about to drop the column `description_vi` on the `stories` table. All the data in the column will be lost.
  - You are about to drop the column `title_en` on the `stories` table. All the data in the column will be lost.
  - You are about to drop the column `title_vi` on the `stories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug,language]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug,language]` on the table `stories` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `categories_name_key` ON `categories`;

-- DropIndex
DROP INDEX `categories_slug_key` ON `categories`;

-- DropIndex
DROP INDEX `stories_slug_key` ON `stories`;

-- AlterTable
ALTER TABLE `categories` DROP COLUMN `name_en`,
    DROP COLUMN `name_vi`;

-- AlterTable
ALTER TABLE `chapters` DROP COLUMN `audio_url_en`,
    DROP COLUMN `audio_url_vi`,
    DROP COLUMN `content_en`,
    DROP COLUMN `content_vi`,
    DROP COLUMN `description_en`,
    DROP COLUMN `description_vi`,
    DROP COLUMN `title_en`,
    DROP COLUMN `title_vi`,
    ADD COLUMN `audio_url` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `stories` DROP COLUMN `description_en`,
    DROP COLUMN `description_vi`,
    DROP COLUMN `title_en`,
    DROP COLUMN `title_vi`,
    ALTER COLUMN `title` DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX `categories_slug_language_key` ON `categories`(`slug`, `language`);

-- CreateIndex
CREATE INDEX `stories_language_idx` ON `stories`(`language`);

-- CreateIndex
CREATE UNIQUE INDEX `stories_slug_language_key` ON `stories`(`slug`, `language`);
