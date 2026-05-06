-- Add story-level unlock price/discount and chapter discount
ALTER TABLE `stories`
  ADD COLUMN `unlock_price` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `discount_percent` INTEGER UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE `chapters`
  ADD COLUMN `discount_percent` INTEGER UNSIGNED NOT NULL DEFAULT 0;

-- Ledger for story-level unlock by Pulse
CREATE TABLE `user_story_unlocks` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `story_id` VARCHAR(36) NOT NULL,
  `pulse_amount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_story_unlocks_user_id_story_id_key`(`user_id`, `story_id`),
  INDEX `user_story_unlocks_user_id_idx`(`user_id`),
  INDEX `user_story_unlocks_story_id_idx`(`story_id`),
  INDEX `user_story_unlocks_created_at_idx`(`created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_story_unlocks`
  ADD CONSTRAINT `user_story_unlocks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_story_unlocks_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
