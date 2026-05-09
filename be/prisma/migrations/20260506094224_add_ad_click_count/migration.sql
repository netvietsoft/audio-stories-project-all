-- AlterTable
ALTER TABLE `advertisements` ADD COLUMN `click_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    MODIFY `image_url` TEXT NULL,
    MODIFY `target_url` VARCHAR(500) NULL;
