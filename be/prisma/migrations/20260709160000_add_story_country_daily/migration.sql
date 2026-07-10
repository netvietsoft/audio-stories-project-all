-- CreateTable
CREATE TABLE `story_country_daily` (
    `story_id` VARCHAR(36) NOT NULL,
    `country` CHAR(2) NOT NULL,
    `date` DATE NOT NULL,
    `kind` VARCHAR(10) NOT NULL,
    `count` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    INDEX `story_country_daily_kind_country_idx`(`kind`, `country`),
    INDEX `story_country_daily_kind_story_id_idx`(`kind`, `story_id`),
    PRIMARY KEY (`story_id`, `country`, `date`, `kind`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `story_country_daily` ADD CONSTRAINT `story_country_daily_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
