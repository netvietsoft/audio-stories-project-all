-- AlterTable
ALTER TABLE `chapters` ADD COLUMN `language` VARCHAR(8) NOT NULL DEFAULT 'vi';

-- CreateIndex
CREATE INDEX `chapters_language_idx` ON `chapters`(`language`);
