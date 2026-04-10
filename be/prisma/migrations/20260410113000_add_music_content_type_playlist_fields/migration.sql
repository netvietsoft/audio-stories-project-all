-- AlterTable
ALTER TABLE `music_tracks`
  ADD COLUMN `content_type` ENUM('single', 'playlist') NOT NULL DEFAULT 'single' AFTER `audio_duration`,
  ADD COLUMN `playlist_track_ids` JSON NULL AFTER `content_type`;

-- CreateIndex
CREATE INDEX `music_tracks_content_type_idx` ON `music_tracks`(`content_type`);
