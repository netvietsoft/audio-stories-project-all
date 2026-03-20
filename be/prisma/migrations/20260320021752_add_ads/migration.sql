-- AlterTable
ALTER TABLE `chapter_variants` ADD COLUMN `is_default` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `next_chapter_id` VARCHAR(36) NULL,
    ADD COLUMN `next_variant_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `chapters` ADD COLUMN `is_interactive` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `stories` ADD COLUMN `is_interactive` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `hero_banners` (
    `id` VARCHAR(36) NOT NULL,
    `title_vi` VARCHAR(255) NOT NULL,
    `title_en` VARCHAR(255) NOT NULL,
    `subtitle_vi` VARCHAR(500) NULL,
    `subtitle_en` VARCHAR(500) NULL,
    `image_url` TEXT NOT NULL,
    `target_url` VARCHAR(500) NOT NULL,
    `story_id` VARCHAR(36) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `hero_banners_story_id_idx`(`story_id`),
    INDEX `hero_banners_is_active_display_order_idx`(`is_active`, `display_order`),
    INDEX `hero_banners_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `advertisements` (
    `id` VARCHAR(36) NOT NULL,
    `partner_name` VARCHAR(120) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `image_url` TEXT NOT NULL,
    `target_url` VARCHAR(500) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `advertisements_is_active_updated_at_idx`(`is_active`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `chapter_variants_next_chapter_id_idx` ON `chapter_variants`(`next_chapter_id`);

-- CreateIndex
CREATE INDEX `stories_is_interactive_idx` ON `stories`(`is_interactive`);

-- AddForeignKey
ALTER TABLE `hero_banners` ADD CONSTRAINT `hero_banners_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapter_variants` ADD CONSTRAINT `chapter_variants_next_chapter_id_fkey` FOREIGN KEY (`next_chapter_id`) REFERENCES `chapters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
