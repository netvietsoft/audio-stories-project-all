-- CreateTable
CREATE TABLE `languages` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(16) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `languages_key_key`(`key`),
    INDEX `languages_is_active_display_order_idx`(`is_active`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
