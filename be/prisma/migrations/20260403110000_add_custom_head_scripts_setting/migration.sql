-- Insert custom_head_scripts setting if not exists
INSERT IGNORE INTO `site_settings` (`key`, `value`, `type`, `description`, `updated_at`)
VALUES ('custom_head_scripts', '', 'string', 'Custom JavaScript/HTML code to inject into <head> tag (e.g., Google Analytics, Facebook Pixel)', NOW());
