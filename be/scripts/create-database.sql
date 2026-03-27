-- Create database for NetViet Audio
-- Run this script before deploying the application

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS `netviet_audio` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Create user if not exists (MySQL 8.0+)
CREATE USER IF NOT EXISTS 'netviet_audio_db'@'localhost' IDENTIFIED BY 'NetViet72Audio_6df39';
CREATE USER IF NOT EXISTS 'netviet_audio_db'@'%' IDENTIFIED BY 'NetViet72Audio_6df39';

-- Grant privileges
GRANT ALL PRIVILEGES ON `netviet_audio`.* TO 'netviet_audio_db'@'localhost';
GRANT ALL PRIVILEGES ON `netviet_audio`.* TO 'netviet_audio_db'@'%';

-- Flush privileges
FLUSH PRIVILEGES;

-- Show databases
SHOW DATABASES LIKE 'netviet_audio';

-- Show grants
SHOW GRANTS FOR 'netviet_audio_db'@'localhost';
