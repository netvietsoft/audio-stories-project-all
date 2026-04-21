/*
  Warnings:

  - You are about to drop the column `facebook_group_url` on the `stories` table. All the data in the column will be lost.
  - You are about to drop the column `instagram_url` on the `stories` table. All the data in the column will be lost.
  - You are about to drop the column `reddit_url` on the `stories` table. All the data in the column will be lost.
  - You are about to drop the column `twitter_url` on the `stories` table. All the data in the column will be lost.
  - You are about to drop the column `whatsapp_url` on the `stories` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `credit_transactions_user_id_created_at_idx` ON `credit_transactions`;

-- DropIndex
DROP INDEX `listening_history_user_id_last_listened_at_idx` ON `listening_history`;

-- DropIndex
DROP INDEX `notifications_user_id_is_read_created_at_idx` ON `notifications`;

-- DropIndex
DROP INDEX `reviews_story_id_created_at_idx` ON `reviews`;

-- DropIndex
DROP INDEX `reviews_story_id_helpful_count_idx` ON `reviews`;

-- DropIndex
DROP INDEX `reviews_story_id_likes_count_idx` ON `reviews`;

-- DropIndex
DROP INDEX `stories_average_rating_idx` ON `stories`;

-- DropIndex
DROP INDEX `stories_total_views_idx` ON `stories`;

-- DropIndex
DROP INDEX `user_favorites_user_id_created_at_idx` ON `user_favorites`;

-- AlterTable
ALTER TABLE `chapters` ADD COLUMN `unlock_price` INTEGER UNSIGNED NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `music_comments` ADD COLUMN `like_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN `parent_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `music_tracks` ADD COLUMN `access_type` ENUM('free', 'vip') NOT NULL DEFAULT 'free',
    ADD COLUMN `intro_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `unlock_price` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    MODIFY `content_type` ENUM('single', 'podcast', 'playlist') NOT NULL DEFAULT 'single';

-- AlterTable
ALTER TABLE `stories` DROP COLUMN `facebook_group_url`,
    DROP COLUMN `instagram_url`,
    DROP COLUMN `reddit_url`,
    DROP COLUMN `twitter_url`,
    DROP COLUMN `whatsapp_url`;

-- CreateTable
CREATE TABLE `music_comment_likes` (
    `user_id` VARCHAR(36) NOT NULL,
    `comment_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `music_comment_likes_comment_id_idx`(`comment_id`),
    INDEX `music_comment_likes_user_id_idx`(`user_id`),
    PRIMARY KEY (`user_id`, `comment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `music_unlocks` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `music_id` VARCHAR(36) NOT NULL,
    `source_type` ENUM('track', 'playlist') NOT NULL DEFAULT 'track',
    `source_playlist_id` VARCHAR(36) NULL,
    `credits_spent` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `music_unlocks_user_id_idx`(`user_id`),
    INDEX `music_unlocks_music_id_idx`(`music_id`),
    INDEX `music_unlocks_source_playlist_id_idx`(`source_playlist_id`),
    UNIQUE INDEX `music_unlocks_user_id_music_id_key`(`user_id`, `music_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `credit_transactions_user_id_created_at_idx` ON `credit_transactions`(`user_id`, `created_at`);

-- CreateIndex
CREATE INDEX `listening_history_user_id_last_listened_at_idx` ON `listening_history`(`user_id`, `last_listened_at`);

-- CreateIndex
CREATE INDEX `music_comments_parent_id_idx` ON `music_comments`(`parent_id`);

-- CreateIndex
CREATE INDEX `notifications_user_id_is_read_created_at_idx` ON `notifications`(`user_id`, `is_read`, `created_at`);

-- CreateIndex
CREATE INDEX `reviews_story_id_created_at_idx` ON `reviews`(`story_id`, `created_at`);

-- CreateIndex
CREATE INDEX `reviews_story_id_likes_count_idx` ON `reviews`(`story_id`, `likes_count`);

-- CreateIndex
CREATE INDEX `reviews_story_id_helpful_count_idx` ON `reviews`(`story_id`, `helpful_count`);

-- CreateIndex
CREATE INDEX `stories_total_views_idx` ON `stories`(`total_views`);

-- CreateIndex
CREATE INDEX `stories_average_rating_idx` ON `stories`(`average_rating`);

-- CreateIndex
CREATE INDEX `user_favorites_user_id_created_at_idx` ON `user_favorites`(`user_id`, `created_at`);

-- AddForeignKey
ALTER TABLE `music_comments` ADD CONSTRAINT `music_comments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `music_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_comment_likes` ADD CONSTRAINT `music_comment_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_comment_likes` ADD CONSTRAINT `music_comment_likes_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `music_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_unlocks` ADD CONSTRAINT `music_unlocks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_unlocks` ADD CONSTRAINT `music_unlocks_music_id_fkey` FOREIGN KEY (`music_id`) REFERENCES `music_tracks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_unlocks` ADD CONSTRAINT `music_unlocks_source_playlist_id_fkey` FOREIGN KEY (`source_playlist_id`) REFERENCES `music_tracks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `categories` RENAME INDEX `categories_slug_language_key` TO `categories_slug_language_id_key`;

-- RenameIndex
ALTER TABLE `stories` RENAME INDEX `stories_slug_language_key` TO `stories_slug_language_id_key`;
