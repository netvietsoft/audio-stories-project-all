-- CreateTable
CREATE TABLE `user_chapter_unlocks` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `chapter_id` VARCHAR(36) NOT NULL,
    `pulse_amount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `unlock_type` ENUM('VIP', 'TIMED', 'PULSE') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_chapter_unlocks_chapter_id_idx`(`chapter_id`),
    INDEX `user_chapter_unlocks_user_id_idx`(`user_id`),
    INDEX `user_chapter_unlocks_unlock_type_idx`(`unlock_type`),
    INDEX `user_chapter_unlocks_created_at_idx`(`created_at`),
    UNIQUE INDEX `user_chapter_unlocks_user_id_chapter_id_key`(`user_id`, `chapter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_chapter_unlocks` ADD CONSTRAINT `user_chapter_unlocks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_chapter_unlocks` ADD CONSTRAINT `user_chapter_unlocks_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
