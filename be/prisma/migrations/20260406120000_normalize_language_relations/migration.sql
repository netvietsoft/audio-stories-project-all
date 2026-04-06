-- AlterTable
ALTER TABLE `authors`
    ADD COLUMN `language_id` INTEGER UNSIGNED NULL;

ALTER TABLE `categories`
    ADD COLUMN `language_id` INTEGER UNSIGNED NULL;

ALTER TABLE `stories`
    ADD COLUMN `language_id` INTEGER UNSIGNED NULL;

ALTER TABLE `chapters`
    ADD COLUMN `language_id` INTEGER UNSIGNED NULL;

ALTER TABLE `advertisements`
    ADD COLUMN `language_id` INTEGER UNSIGNED NULL,
    ADD COLUMN `is_global` BOOLEAN NOT NULL DEFAULT true;

-- Backfill language relations from the legacy language string columns
UPDATE `authors` a
LEFT JOIN `languages` l ON l.`key` = a.`language`
SET a.`language_id` = l.`id`
WHERE a.`language_id` IS NULL;

UPDATE `categories` c
LEFT JOIN `languages` l ON l.`key` = c.`language`
SET c.`language_id` = l.`id`
WHERE c.`language_id` IS NULL;

UPDATE `stories` s
LEFT JOIN `languages` l ON l.`key` = s.`language`
SET s.`language_id` = l.`id`
WHERE s.`language_id` IS NULL;

UPDATE `chapters` c
LEFT JOIN `languages` l ON l.`key` = c.`language`
SET c.`language_id` = l.`id`
WHERE c.`language_id` IS NULL;

UPDATE `advertisements`
SET `is_global` = true;

-- Add indexes before tightening constraints / adding foreign keys
CREATE INDEX `authors_language_id_idx` ON `authors`(`language_id`);
CREATE INDEX `categories_language_id_idx` ON `categories`(`language_id`);
CREATE INDEX `stories_language_id_idx` ON `stories`(`language_id`);
CREATE INDEX `chapters_language_id_idx` ON `chapters`(`language_id`);
CREATE INDEX `advertisements_language_id_idx` ON `advertisements`(`language_id`);
CREATE INDEX `advertisements_is_global_idx` ON `advertisements`(`is_global`);

-- Drop legacy unique indexes before removing the old language columns.
-- MySQL can otherwise try to preserve them as slug-only unique keys during the column drop.
ALTER TABLE `categories`
    DROP INDEX `categories_slug_language_key`;

ALTER TABLE `stories`
    DROP INDEX `stories_slug_language_key`;

-- Remove legacy string columns after data has been copied
ALTER TABLE `authors`
    DROP COLUMN `language`;

ALTER TABLE `categories`
    DROP COLUMN `language`;

ALTER TABLE `stories`
    DROP COLUMN `language`;

ALTER TABLE `chapters`
    DROP COLUMN `language`;

-- Tighten nullability after backfill is complete
ALTER TABLE `authors`
    MODIFY COLUMN `language_id` INTEGER UNSIGNED NOT NULL;

ALTER TABLE `categories`
    MODIFY COLUMN `language_id` INTEGER UNSIGNED NOT NULL;

ALTER TABLE `stories`
    MODIFY COLUMN `language_id` INTEGER UNSIGNED NOT NULL;

ALTER TABLE `chapters`
    MODIFY COLUMN `language_id` INTEGER UNSIGNED NOT NULL;

-- Recreate the uniqueness guarantees on the normalized language relation columns
ALTER TABLE `categories`
    ADD UNIQUE INDEX `categories_slug_language_key` (`slug`, `language_id`);

ALTER TABLE `stories`
    ADD UNIQUE INDEX `stories_slug_language_key` (`slug`, `language_id`);

-- Add foreign keys last so backfill can complete without constraint failures
ALTER TABLE `authors`
    ADD CONSTRAINT `authors_language_id_fkey`
    FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `categories`
    ADD CONSTRAINT `categories_language_id_fkey`
    FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stories`
    ADD CONSTRAINT `stories_language_id_fkey`
    FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `chapters`
    ADD CONSTRAINT `chapters_language_id_fkey`
    FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `advertisements`
    ADD CONSTRAINT `advertisements_language_id_fkey`
    FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
