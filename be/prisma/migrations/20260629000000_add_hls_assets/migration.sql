-- CreateTable
CREATE TABLE `hls_assets` (
    `id` VARCHAR(36) NOT NULL,
    `asset_type` ENUM('chapter', 'variant', 'music') NOT NULL,
    `asset_id` VARCHAR(36) NOT NULL,
    `status` ENUM('pending', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'pending',
    `playlist_url` VARCHAR(500) NULL,
    `enc_key` LONGBLOB NOT NULL,
    `key_iv` VARCHAR(32) NOT NULL,
    `duration_sec` INTEGER UNSIGNED NULL,
    `error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `hls_assets_status_idx`(`status`),
    UNIQUE INDEX `hls_assets_asset_type_asset_id_key`(`asset_type`, `asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
