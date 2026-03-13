-- CreateTable
CREATE TABLE `user_story_subscriptions` (
    `user_id` VARCHAR(36) NOT NULL,
    `story_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_story_subscriptions_user_id_idx`(`user_id`),
    INDEX `user_story_subscriptions_story_id_idx`(`story_id`),
    INDEX `user_story_subscriptions_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`user_id`, `story_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_story_subscriptions` ADD CONSTRAINT `user_story_subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_story_subscriptions` ADD CONSTRAINT `user_story_subscriptions_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
