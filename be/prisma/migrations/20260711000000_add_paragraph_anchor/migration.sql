-- Content-based anchor for paragraph-scope comments (normalized first 100 chars).
-- Complements the legacy positional index kept in `timestamp_seconds`.
ALTER TABLE `chapter_comments` ADD COLUMN `paragraph_anchor` VARCHAR(120) NULL;
