-- CreateTable
CREATE TABLE `music_tracks` (
    `id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `artist` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `tags` JSON NULL,
    `thumbnail_url` TEXT NULL,
    `audio_url` VARCHAR(500) NOT NULL,
    `audio_duration` INTEGER UNSIGNED NULL,
    `play_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `like_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `comment_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `music_tracks_is_public_idx`(`is_public`),
    INDEX `music_tracks_created_at_idx`(`created_at`),
    INDEX `music_tracks_play_count_idx`(`play_count`),
    INDEX `music_tracks_like_count_idx`(`like_count`),
    INDEX `music_tracks_comment_count_idx`(`comment_count`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `music_comments` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `music_id` VARCHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `music_comments_user_id_idx`(`user_id`),
    INDEX `music_comments_music_id_idx`(`music_id`),
    INDEX `music_comments_music_id_created_at_idx`(`music_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `music_likes` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `music_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `music_likes_music_id_idx`(`music_id`),
    INDEX `music_likes_user_id_idx`(`user_id`),
    UNIQUE INDEX `music_likes_user_id_music_id_key`(`user_id`, `music_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `music_history` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `music_id` VARCHAR(36) NOT NULL,
    `listened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `music_history_user_id_idx`(`user_id`),
    INDEX `music_history_music_id_idx`(`music_id`),
    INDEX `music_history_user_id_listened_at_idx`(`user_id`, `listened_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `music_playlists` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `cover_image` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `music_playlists_user_id_idx`(`user_id`),
    INDEX `music_playlists_is_public_idx`(`is_public`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `music_playlist_tracks` (
    `playlist_id` VARCHAR(36) NOT NULL,
    `music_id` VARCHAR(36) NOT NULL,
    `order_index` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `added_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `music_playlist_tracks_music_id_idx`(`music_id`),
    INDEX `music_playlist_tracks_order_index_idx`(`order_index`),
    PRIMARY KEY (`playlist_id`, `music_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `music_comments` ADD CONSTRAINT `music_comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_comments` ADD CONSTRAINT `music_comments_music_id_fkey` FOREIGN KEY (`music_id`) REFERENCES `music_tracks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_likes` ADD CONSTRAINT `music_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_likes` ADD CONSTRAINT `music_likes_music_id_fkey` FOREIGN KEY (`music_id`) REFERENCES `music_tracks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_history` ADD CONSTRAINT `music_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_history` ADD CONSTRAINT `music_history_music_id_fkey` FOREIGN KEY (`music_id`) REFERENCES `music_tracks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_playlists` ADD CONSTRAINT `music_playlists_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_playlist_tracks` ADD CONSTRAINT `music_playlist_tracks_playlist_id_fkey` FOREIGN KEY (`playlist_id`) REFERENCES `music_playlists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `music_playlist_tracks` ADD CONSTRAINT `music_playlist_tracks_music_id_fkey` FOREIGN KEY (`music_id`) REFERENCES `music_tracks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
