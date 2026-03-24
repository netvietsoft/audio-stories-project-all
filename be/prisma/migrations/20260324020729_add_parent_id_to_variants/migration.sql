-- AlterTable
ALTER TABLE `chapter_variants` ADD COLUMN `parent_id` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `chapter_variants_parent_id_idx` ON `chapter_variants`(`parent_id`);

-- AddForeignKey
ALTER TABLE `chapter_variants` ADD CONSTRAINT `chapter_variants_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `chapter_variants`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
