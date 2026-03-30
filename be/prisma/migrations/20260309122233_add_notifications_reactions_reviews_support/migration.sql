-- Add notification preference columns
ALTER TABLE `users`
ADD COLUMN `allow_email_noti` BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN `allow_bell_noti` BOOLEAN NOT NULL DEFAULT true;

-- Add recommendation flag for stories
ALTER TABLE `stories`
ADD COLUMN `is_recommended` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `stories_is_recommended_updated_at_idx` ON `stories`(`is_recommended`, `updated_at`);

-- Add reactions on chapter comments
CREATE TABLE `comment_reactions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `comment_id` VARCHAR(36) NOT NULL,
    `type` ENUM('helpful', 'like', 'love') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `comment_reactions_comment_id_idx`(`comment_id`),
    INDEX `comment_reactions_user_id_idx`(`user_id`),
    INDEX `comment_reactions_comment_id_type_idx`(`comment_id`, `type`),
    UNIQUE INDEX `comment_reactions_user_id_comment_id_type_key`(`user_id`, `comment_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `comment_reactions`
ADD CONSTRAINT `comment_reactions_user_id_fkey`
FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `comment_reactions`
ADD CONSTRAINT `comment_reactions_comment_id_fkey`
FOREIGN KEY (`comment_id`) REFERENCES `chapter_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
