/*
  Warnings:

  - A unique constraint covering the columns `[user_id,chapter_id,variant_id]` on the table `listening_history` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `listening_history_user_id_chapter_id_key` ON `listening_history`;

-- AlterTable
ALTER TABLE `chapter_comments` ADD COLUMN `variant_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `listening_history` ADD COLUMN `variant_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `stories` ADD COLUMN `favorites_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN `total_gifts` INTEGER UNSIGNED NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `chapter_variants` (
    `id` VARCHAR(36) NOT NULL,
    `chapter_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `content` LONGTEXT NULL,
    `audio_url` VARCHAR(500) NULL,
    `r2_audio_url` VARCHAR(500) NULL,
    `audio_duration` INTEGER UNSIGNED NULL,
    `unlock_price` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `order_index` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `chapter_variants_chapter_id_idx`(`chapter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_unlocked_variants` (
    `user_id` VARCHAR(36) NOT NULL,
    `variant_id` VARCHAR(36) NOT NULL,
    `unlocked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_unlocked_variants_user_id_idx`(`user_id`),
    INDEX `user_unlocked_variants_variant_id_idx`(`variant_id`),
    PRIMARY KEY (`user_id`, `variant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `listening_history_user_id_chapter_id_variant_id_key` ON `listening_history`(`user_id`, `chapter_id`, `variant_id`);

-- AddForeignKey
ALTER TABLE `listening_history` ADD CONSTRAINT `listening_history_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `chapter_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapter_comments` ADD CONSTRAINT `chapter_comments_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `chapter_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapter_variants` ADD CONSTRAINT `chapter_variants_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_unlocked_variants` ADD CONSTRAINT `user_unlocked_variants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_unlocked_variants` ADD CONSTRAINT `user_unlocked_variants_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `chapter_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
