-- AlterTable
ALTER TABLE `authors` ADD COLUMN `language` VARCHAR(8) NOT NULL DEFAULT 'vi';

-- AlterTable
ALTER TABLE `categories` ADD COLUMN `language` VARCHAR(8) NOT NULL DEFAULT 'vi';

-- CreateIndex
CREATE INDEX `authors_language_idx` ON `authors`(`language`);

-- CreateIndex
CREATE INDEX `categories_language_idx` ON `categories`(`language`);
