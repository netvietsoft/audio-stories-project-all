-- AlterTable
ALTER TABLE `music_history`
    ADD COLUMN `progress_seconds` INTEGER UNSIGNED NOT NULL DEFAULT 0 AFTER `music_id`;
