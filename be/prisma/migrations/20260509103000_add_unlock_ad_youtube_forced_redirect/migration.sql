-- AlterTable
ALTER TABLE `advertisements`
  ADD COLUMN `youtube_id` VARCHAR(20) NULL,
  ADD COLUMN `youtube_play_time` INTEGER UNSIGNED NULL DEFAULT 31,
  ADD COLUMN `is_forced_redirect` BOOLEAN NOT NULL DEFAULT false;
