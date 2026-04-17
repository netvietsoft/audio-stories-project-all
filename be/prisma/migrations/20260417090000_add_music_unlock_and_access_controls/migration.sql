-- AlterTable
ALTER TABLE `music_tracks`
  MODIFY COLUMN `content_type` ENUM('single', 'podcast', 'playlist') NOT NULL DEFAULT 'single',
  ADD COLUMN `access_type` ENUM('free', 'vip') NOT NULL DEFAULT 'free' AFTER `content_type`,
  ADD COLUMN `unlock_price` INTEGER UNSIGNED NOT NULL DEFAULT 0 AFTER `access_type`,
  ADD COLUMN `intro_enabled` BOOLEAN NOT NULL DEFAULT true AFTER `unlock_price`;

-- AlterTable
ALTER TABLE `chapters`
  ADD COLUMN `unlock_price` INTEGER UNSIGNED NOT NULL DEFAULT 0 AFTER `access_type`;

-- CreateTable
CREATE TABLE `music_unlocks` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `music_id` VARCHAR(36) NOT NULL,
  `source_type` ENUM('track', 'playlist') NOT NULL DEFAULT 'track',
  `source_playlist_id` VARCHAR(36) NULL,
  `credits_spent` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `music_unlocks_user_id_music_id_key`(`user_id`, `music_id`),
  INDEX `music_unlocks_user_id_idx`(`user_id`),
  INDEX `music_unlocks_music_id_idx`(`music_id`),
  INDEX `music_unlocks_source_playlist_id_idx`(`source_playlist_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `music_tracks_access_type_idx` ON `music_tracks`(`access_type`);

-- AddForeignKey
ALTER TABLE `music_unlocks`
  ADD CONSTRAINT `music_unlocks_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_unlocks`
  ADD CONSTRAINT `music_unlocks_music_id_fkey`
  FOREIGN KEY (`music_id`) REFERENCES `music_tracks`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_unlocks`
  ADD CONSTRAINT `music_unlocks_source_playlist_id_fkey`
  FOREIGN KEY (`source_playlist_id`) REFERENCES `music_tracks`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
