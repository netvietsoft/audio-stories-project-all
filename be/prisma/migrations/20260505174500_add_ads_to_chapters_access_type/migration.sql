-- Align DB enum with Prisma schema so chapters can persist ad-based access mode.
ALTER TABLE `chapters`
  MODIFY `access_type` ENUM('free', 'timed', 'vip', 'ads') NOT NULL DEFAULT 'free';
