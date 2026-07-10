-- CreateTable
CREATE TABLE `story_view_daily` (
    `story_id` VARCHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `views` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    INDEX `story_view_daily_date_idx`(`date`),
    PRIMARY KEY (`story_id`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `story_view_daily` ADD CONSTRAINT `story_view_daily_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
