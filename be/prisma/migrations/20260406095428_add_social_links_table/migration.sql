-- CreateEnum
CREATE TABLE `social_links` (
    `id` VARCHAR(36) NOT NULL,
    `platform` ENUM('facebook', 'telegram', 'zalo', 'instagram', 'twitter', 'reddit', 'discord', 'youtube', 'tiktok', 'other') NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `icon_url` TEXT NULL,
    `order_index` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `social_links_is_active_order_index_idx`(`is_active`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
