-- CreateTable
CREATE TABLE `labels` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `text` VARCHAR(40) NOT NULL,
    `color` VARCHAR(20) NOT NULL,
    `text_color` VARCHAR(20) NULL,
    `icon` VARCHAR(60) NULL,
    `default_duration_days` INTEGER UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `labels_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `stories` ADD COLUMN `label_id` INTEGER UNSIGNED NULL,
    ADD COLUMN `label_assigned_at` DATETIME(3) NULL,
    ADD COLUMN `label_expires_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `stories_label_id_idx` ON `stories`(`label_id`);

-- AddForeignKey
ALTER TABLE `stories` ADD CONSTRAINT `stories_label_id_fkey` FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
