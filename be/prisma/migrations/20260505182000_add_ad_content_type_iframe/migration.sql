-- Add support for iframe-based ads (e.g. Google ads embed) while keeping image mode.
ALTER TABLE `advertisements`
  ADD COLUMN `content_type` ENUM('image', 'iframe') NOT NULL DEFAULT 'image' AFTER `title`,
  ADD COLUMN `iframe_code` LONGTEXT NULL AFTER `target_url`;

-- Existing rows are image ads.
UPDATE `advertisements`
SET `content_type` = 'image'
WHERE `content_type` IS NULL;
