-- Alter advertisements content_type enum to support youtube option
ALTER TABLE `advertisements`
  MODIFY `content_type` ENUM('image', 'iframe', 'youtube') NOT NULL DEFAULT 'image';
