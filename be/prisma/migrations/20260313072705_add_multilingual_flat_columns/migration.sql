-- AlterTable
ALTER TABLE `chapters` ADD COLUMN `audio_url_en` VARCHAR(500) NULL,
    ADD COLUMN `audio_url_vi` VARCHAR(500) NULL,
    ADD COLUMN `content_en` LONGTEXT NULL,
    ADD COLUMN `content_vi` LONGTEXT NULL,
    ADD COLUMN `description_en` TEXT NULL,
    ADD COLUMN `description_vi` TEXT NULL,
    ADD COLUMN `title_en` VARCHAR(300) NOT NULL DEFAULT '',
    ADD COLUMN `title_vi` VARCHAR(300) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `stories` ADD COLUMN `description_en` TEXT NULL,
    ADD COLUMN `description_vi` TEXT NULL,
    ADD COLUMN `facebook_group_url` VARCHAR(500) NULL,
    ADD COLUMN `title_en` VARCHAR(300) NOT NULL DEFAULT '',
    ADD COLUMN `title_vi` VARCHAR(300) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE `comment_reports` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `comment_id` VARCHAR(36) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('pending', 'reviewed', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
    `admin_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `comment_reports_user_id_idx`(`user_id`),
    INDEX `comment_reports_comment_id_idx`(`comment_id`),
    INDEX `comment_reports_status_idx`(`status`),
    INDEX `comment_reports_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `comment_reports` ADD CONSTRAINT `comment_reports_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_reports` ADD CONSTRAINT `comment_reports_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `chapter_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
