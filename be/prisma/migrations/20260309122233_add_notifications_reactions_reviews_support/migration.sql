-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `avatar_url` TEXT NULL,
    `role_id` INTEGER UNSIGNED NOT NULL DEFAULT 4,
    `credits` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `google_id` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `total_unlocked_stories` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `vip_tier` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `vip_expiration_date` DATETIME(3) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `allow_email_noti` BOOLEAN NOT NULL DEFAULT true,
    `allow_bell_noti` BOOLEAN NOT NULL DEFAULT true,
    `country` VARCHAR(100) NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_google_id_key`(`google_id`),
    INDEX `users_role_id_idx`(`role_id`),
    INDEX `users_is_active_idx`(`is_active`),
    INDEX `users_total_unlocked_stories_idx`(`total_unlocked_stories`),
    INDEX `users_vip_tier_idx`(`vip_tier`),
    INDEX `users_deleted_at_idx`(`deleted_at`),
    INDEX `users_vip_expiration_date_idx`(`vip_expiration_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_oauth_account` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_user_id` VARCHAR(255) NOT NULL,
    `profile` JSON NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `auth_oauth_account_user_id_fkey`(`user_id`),
    UNIQUE INDEX `auth_oauth_account_provider_provider_user_id_key`(`provider`, `provider_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_tokens` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `type` ENUM('VERIFY_EMAIL', 'VERIFY_CODE', 'PASSWORD_RESET') NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `is_used` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `auth_tokens_token_key`(`token`),
    INDEX `auth_tokens_user_id_type_idx`(`user_id`, `type`),
    INDEX `auth_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authors` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `avatar_url` TEXT NULL,
    `bio` TEXT NULL,
    `followers_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `authors_slug_key`(`slug`),
    INDEX `authors_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `slug` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `permissions` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `roles_name_key`(`name`),
    UNIQUE INDEX `roles_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `icon_url` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `categories_name_key`(`name`),
    UNIQUE INDEX `categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stories` (
    `id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `slug` VARCHAR(350) NOT NULL,
    `description` TEXT NULL,
    `thumbnail_url` TEXT NULL,
    `author_id` VARCHAR(36) NOT NULL,
    `status` ENUM('ongoing', 'completed') NOT NULL DEFAULT 'ongoing',
    `total_chapters` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `total_views` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `average_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `rating_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `is_recommended` BOOLEAN NOT NULL DEFAULT false,
    `featured_order` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `audio_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `stories_slug_key`(`slug`),
    INDEX `stories_title_idx`(`title`),
    INDEX `stories_author_id_idx`(`author_id`),
    INDEX `stories_status_is_featured_published_at_updated_at_idx`(`status`, `is_featured`, `published_at`, `updated_at`),
    INDEX `stories_total_views_idx`(`total_views` DESC),
    INDEX `stories_average_rating_idx`(`average_rating` DESC),
    INDEX `stories_is_recommended_updated_at_idx`(`is_recommended`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `story_categories` (
    `story_id` VARCHAR(36) NOT NULL,
    `category_id` INTEGER UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `story_categories_story_id_idx`(`story_id`),
    INDEX `story_categories_category_id_idx`(`category_id`),
    PRIMARY KEY (`story_id`, `category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chapters` (
    `id` VARCHAR(36) NOT NULL,
    `story_id` VARCHAR(36) NULL,
    `chapter_number` FLOAT NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `content` LONGTEXT NULL,
    `r2_audio_url` VARCHAR(500) NULL,
    `youtube_video_id` VARCHAR(20) NULL,
    `audio_duration` INTEGER UNSIGNED NULL,
    `access_type` ENUM('free', 'timed', 'vip') NOT NULL DEFAULT 'free',
    `unlocks_at` DATETIME(3) NULL,
    `view_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `chapters_access_type_idx`(`access_type`),
    INDEX `chapters_unlocks_at_idx`(`unlocks_at`),
    INDEX `chapters_story_id_chapter_number_idx`(`story_id`, `chapter_number` ASC),
    UNIQUE INDEX `chapters_story_id_chapter_number_key`(`story_id`, `chapter_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_favorites` (
    `user_id` VARCHAR(36) NOT NULL,
    `story_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_favorites_user_id_idx`(`user_id`),
    INDEX `user_favorites_story_id_idx`(`story_id`),
    INDEX `user_favorites_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    PRIMARY KEY (`user_id`, `story_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `listening_history` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `story_id` VARCHAR(36) NOT NULL,
    `chapter_id` VARCHAR(36) NOT NULL,
    `progress_seconds` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `last_listened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `listening_history_user_id_idx`(`user_id`),
    INDEX `listening_history_chapter_id_idx`(`chapter_id`),
    INDEX `listening_history_story_id_idx`(`story_id`),
    INDEX `listening_history_last_listened_at_idx`(`last_listened_at`),
    INDEX `listening_history_user_id_last_listened_at_idx`(`user_id`, `last_listened_at` DESC),
    UNIQUE INDEX `listening_history_user_id_chapter_id_key`(`user_id`, `chapter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_follow_authors` (
    `user_id` VARCHAR(36) NOT NULL,
    `author_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_follow_authors_user_id_idx`(`user_id`),
    INDEX `user_follow_authors_author_id_idx`(`author_id`),
    PRIMARY KEY (`user_id`, `author_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `story_id` VARCHAR(36) NOT NULL,
    `rating` TINYINT NOT NULL,
    `content` TEXT NULL,
    `likes_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reviews_user_id_idx`(`user_id`),
    INDEX `reviews_story_id_idx`(`story_id`),
    INDEX `reviews_story_id_created_at_idx`(`story_id`, `created_at` DESC),
    INDEX `reviews_story_id_likes_count_idx`(`story_id`, `likes_count` DESC),
    UNIQUE INDEX `reviews_user_id_story_id_key`(`user_id`, `story_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_likes` (
    `user_id` VARCHAR(36) NOT NULL,
    `review_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `review_likes_user_id_idx`(`user_id`),
    INDEX `review_likes_review_id_idx`(`review_id`),
    PRIMARY KEY (`user_id`, `review_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_transactions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `type` ENUM('topup', 'spend', 'refund', 'admin_adjust') NOT NULL,
    `amount` INTEGER NOT NULL,
    `balance_before` INTEGER UNSIGNED NOT NULL,
    `balance_after` INTEGER UNSIGNED NOT NULL,
    `reference_id` VARCHAR(36) NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `credit_transactions_user_id_idx`(`user_id`),
    INDEX `credit_transactions_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    INDEX `credit_transactions_type_created_at_idx`(`type`, `created_at`),
    INDEX `credit_transactions_reference_id_idx`(`reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `package_code` VARCHAR(50) NOT NULL,
    `amount_vnd` INTEGER UNSIGNED NOT NULL,
    `credits_added` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `qr_data` TEXT NULL,
    `transaction_code` VARCHAR(100) NULL,
    `paid_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payments_user_id_idx`(`user_id`),
    INDEX `payments_status_expires_at_idx`(`status`, `expires_at`),
    INDEX `payments_transaction_code_idx`(`transaction_code`),
    INDEX `payments_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `memberships` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `type` ENUM('all_authors', 'specific_author') NOT NULL,
    `author_id` VARCHAR(36) NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `credits_spent` INTEGER UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `memberships_user_id_idx`(`user_id`),
    INDEX `memberships_author_id_idx`(`author_id`),
    INDEX `memberships_user_id_type_author_id_end_date_idx`(`user_id`, `type`, `author_id`, `end_date`),
    INDEX `memberships_end_date_idx`(`end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `type` ENUM('new_chapter', 'transaction', 'membership_expiry', 'system') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `body` TEXT NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    INDEX `notifications_user_id_is_read_created_at_idx`(`user_id`, `is_read`, `created_at` DESC),
    INDEX `notifications_type_created_at_idx`(`type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NULL,
    `type` ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
    `description` VARCHAR(255) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `site_settings_key_key`(`key`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `banners` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `image_url` TEXT NOT NULL,
    `link_url` VARCHAR(500) NULL,
    `position` VARCHAR(50) NOT NULL DEFAULT 'home_hero',
    `order_index` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `banners_position_idx`(`position`),
    INDEX `banners_order_index_idx`(`order_index`),
    INDEX `banners_is_active_idx`(`is_active`),
    INDEX `banners_start_date_end_date_idx`(`start_date`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audio_reports` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `chapter_id` VARCHAR(36) NOT NULL,
    `story_id` VARCHAR(36) NOT NULL,
    `type` ENUM('broken_link', 'bad_quality', 'missing_audio', 'wrong_chapter', 'other') NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('pending', 'resolved', 'ignored') NOT NULL DEFAULT 'pending',
    `admin_note` TEXT NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audio_reports_user_id_idx`(`user_id`),
    INDEX `audio_reports_chapter_id_idx`(`chapter_id`),
    INDEX `audio_reports_story_id_idx`(`story_id`),
    INDEX `audio_reports_type_idx`(`type`),
    INDEX `audio_reports_status_idx`(`status`),
    INDEX `audio_reports_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playlists` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `cover_url` TEXT NULL,
    `total_items` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `playlists_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playlist_items` (
    `id` VARCHAR(36) NOT NULL,
    `playlist_id` VARCHAR(36) NOT NULL,
    `chapter_id` VARCHAR(36) NOT NULL,
    `story_id` VARCHAR(36) NOT NULL,
    `order_index` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `added_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `playlist_items_playlist_id_idx`(`playlist_id`),
    INDEX `playlist_items_chapter_id_idx`(`chapter_id`),
    INDEX `playlist_items_story_id_idx`(`story_id`),
    INDEX `playlist_items_order_index_idx`(`order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chapter_comments` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `chapter_id` VARCHAR(36) NOT NULL,
    `story_id` VARCHAR(36) NOT NULL,
    `parent_id` VARCHAR(36) NULL,
    `content` TEXT NOT NULL,
    `timestamp_seconds` INTEGER UNSIGNED NULL,
    `likes_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_hidden` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `chapter_comments_user_id_idx`(`user_id`),
    INDEX `chapter_comments_chapter_id_idx`(`chapter_id`),
    INDEX `chapter_comments_story_id_idx`(`story_id`),
    INDEX `chapter_comments_parent_id_idx`(`parent_id`),
    INDEX `chapter_comments_is_hidden_idx`(`is_hidden`),
    INDEX `chapter_comments_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comment_reactions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `comment_id` VARCHAR(36) NOT NULL,
    `type` ENUM('helpful', 'like', 'love') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `comment_reactions_comment_id_idx`(`comment_id`),
    INDEX `comment_reactions_user_id_idx`(`user_id`),
    INDEX `comment_reactions_comment_id_type_idx`(`comment_id`, `type`),
    UNIQUE INDEX `comment_reactions_user_id_comment_id_type_key`(`user_id`, `comment_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_oauth_account` ADD CONSTRAINT `auth_oauth_account_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stories` ADD CONSTRAINT `stories_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `story_categories` ADD CONSTRAINT `story_categories_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `story_categories` ADD CONSTRAINT `story_categories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapters` ADD CONSTRAINT `chapters_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_favorites` ADD CONSTRAINT `user_favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_favorites` ADD CONSTRAINT `user_favorites_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listening_history` ADD CONSTRAINT `listening_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listening_history` ADD CONSTRAINT `listening_history_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listening_history` ADD CONSTRAINT `listening_history_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_follow_authors` ADD CONSTRAINT `user_follow_authors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_follow_authors` ADD CONSTRAINT `user_follow_authors_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_likes` ADD CONSTRAINT `review_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_likes` ADD CONSTRAINT `review_likes_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_transactions` ADD CONSTRAINT `credit_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audio_reports` ADD CONSTRAINT `audio_reports_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audio_reports` ADD CONSTRAINT `audio_reports_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audio_reports` ADD CONSTRAINT `audio_reports_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playlists` ADD CONSTRAINT `playlists_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playlist_items` ADD CONSTRAINT `playlist_items_playlist_id_fkey` FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playlist_items` ADD CONSTRAINT `playlist_items_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playlist_items` ADD CONSTRAINT `playlist_items_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapter_comments` ADD CONSTRAINT `chapter_comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapter_comments` ADD CONSTRAINT `chapter_comments_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapter_comments` ADD CONSTRAINT `chapter_comments_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapter_comments` ADD CONSTRAINT `chapter_comments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `chapter_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_reactions` ADD CONSTRAINT `comment_reactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_reactions` ADD CONSTRAINT `comment_reactions_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `chapter_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
