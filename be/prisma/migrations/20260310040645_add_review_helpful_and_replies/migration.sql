-- DropIndex
DROP INDEX `credit_transactions_user_id_created_at_idx` ON `credit_transactions`;

-- DropIndex
DROP INDEX `listening_history_user_id_last_listened_at_idx` ON `listening_history`;

-- DropIndex
DROP INDEX `notifications_user_id_is_read_created_at_idx` ON `notifications`;

-- DropIndex
DROP INDEX `reviews_story_id_created_at_idx` ON `reviews`;

-- DropIndex
DROP INDEX `reviews_story_id_likes_count_idx` ON `reviews`;

-- DropIndex
DROP INDEX `stories_average_rating_idx` ON `stories`;

-- DropIndex
DROP INDEX `stories_total_views_idx` ON `stories`;

-- DropIndex
DROP INDEX `user_favorites_user_id_created_at_idx` ON `user_favorites`;

-- AlterTable
ALTER TABLE `reviews` ADD COLUMN `helpful_count` INTEGER UNSIGNED NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `review_helpful` (
    `user_id` VARCHAR(36) NOT NULL,
    `review_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `review_helpful_user_id_idx`(`user_id`),
    INDEX `review_helpful_review_id_idx`(`review_id`),
    PRIMARY KEY (`user_id`, `review_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_replies` (
    `id` VARCHAR(36) NOT NULL,
    `review_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `parent_id` VARCHAR(36) NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `review_replies_review_id_created_at_idx`(`review_id`, `created_at` DESC),
    INDEX `review_replies_user_id_idx`(`user_id`),
    INDEX `review_replies_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `credit_transactions_user_id_created_at_idx` ON `credit_transactions`(`user_id`, `created_at` DESC);

-- CreateIndex
CREATE INDEX `listening_history_user_id_last_listened_at_idx` ON `listening_history`(`user_id`, `last_listened_at` DESC);

-- CreateIndex
CREATE INDEX `notifications_user_id_is_read_created_at_idx` ON `notifications`(`user_id`, `is_read`, `created_at` DESC);

-- CreateIndex
CREATE INDEX `reviews_story_id_created_at_idx` ON `reviews`(`story_id`, `created_at` DESC);

-- CreateIndex
CREATE INDEX `reviews_story_id_likes_count_idx` ON `reviews`(`story_id`, `likes_count` DESC);

-- CreateIndex
CREATE INDEX `reviews_story_id_helpful_count_idx` ON `reviews`(`story_id`, `helpful_count` DESC);

-- CreateIndex
CREATE INDEX `stories_total_views_idx` ON `stories`(`total_views` DESC);

-- CreateIndex
CREATE INDEX `stories_average_rating_idx` ON `stories`(`average_rating` DESC);

-- CreateIndex
CREATE INDEX `user_favorites_user_id_created_at_idx` ON `user_favorites`(`user_id`, `created_at` DESC);

-- AddForeignKey
ALTER TABLE `review_helpful` ADD CONSTRAINT `review_helpful_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_helpful` ADD CONSTRAINT `review_helpful_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_replies` ADD CONSTRAINT `review_replies_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_replies` ADD CONSTRAINT `review_replies_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_replies` ADD CONSTRAINT `review_replies_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `review_replies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
