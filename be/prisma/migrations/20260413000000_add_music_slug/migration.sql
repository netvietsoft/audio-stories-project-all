-- Add slug to music_tracks for slug-based detail routes.
ALTER TABLE `music_tracks`
  ADD COLUMN `slug` VARCHAR(350) NOT NULL,
  ADD UNIQUE INDEX `music_tracks_slug_key`(`slug`);
