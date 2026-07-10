-- Read-along timing (imported SRT/VTT/LRC) stored as parsed+matched cues.
ALTER TABLE `chapters` ADD COLUMN `timing_json` JSON NULL;
