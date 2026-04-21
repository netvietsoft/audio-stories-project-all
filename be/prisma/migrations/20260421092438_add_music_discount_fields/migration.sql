-- AlterTable
ALTER TABLE `music_tracks` ADD COLUMN `discount_percent` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN `original_unlock_price` INTEGER UNSIGNED NULL;

-- Backfill existing VIP rows so old data keeps consistent display
UPDATE `music_tracks`
SET
  `original_unlock_price` = CASE
    WHEN `access_type` = 'vip' AND `unlock_price` > 0 THEN `unlock_price`
    ELSE NULL
  END,
  `discount_percent` = 0;
