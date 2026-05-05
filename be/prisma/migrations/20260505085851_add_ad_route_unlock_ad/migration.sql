-- AlterTable
ALTER TABLE `advertisements` ADD COLUMN `route_type` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `chapters` ADD COLUMN `unlock_ad_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `user_chapter_unlocks` MODIFY `unlock_type` ENUM('VIP', 'TIMED', 'PULSE', 'AD') NOT NULL;

-- AddForeignKey
ALTER TABLE `chapters` ADD CONSTRAINT `chapters_unlock_ad_id_fkey` FOREIGN KEY (`unlock_ad_id`) REFERENCES `advertisements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
