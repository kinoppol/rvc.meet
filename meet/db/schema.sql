-- ============================================================
--  SimpleMeet — Database Schema
--  MariaDB 10.x / MySQL 8.x  |  UTF-8mb4  |  UTC datetimes
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS `simplemeet`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `simplemeet`;

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
    `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `username`      VARCHAR(100)  NOT NULL,
    `password_hash` VARCHAR(255)  NOT NULL,
    `name`          VARCHAR(200)  NOT NULL,
    `role`          VARCHAR(100)  NOT NULL DEFAULT '' COMMENT 'ตำแหน่ง/ฝ่ายงาน',
    `permission`    VARCHAR(20)   NOT NULL DEFAULT 'staff'
                                  COMMENT 'admin | organizer | staff',
    `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Meetings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `meetings` (
    `id`          VARCHAR(20)   NOT NULL,
    `title`       VARCHAR(500)  NOT NULL,
    `description` TEXT,
    `organizer`   VARCHAR(200)  NOT NULL,
    `dept`        VARCHAR(50)   NOT NULL DEFAULT 'exec',
    `invitees`    TEXT,
    `start_time`  DATETIME      NOT NULL COMMENT 'UTC',
    `end_time`    DATETIME      NOT NULL COMMENT 'UTC',
    `platform`    VARCHAR(20)   NOT NULL DEFAULT 'meet',
    `link`        VARCHAR(1000) NOT NULL,
    `location`    VARCHAR(500)           DEFAULT NULL,
    `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_start` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Attachments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `attachments` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `meeting_id`  VARCHAR(20)  NOT NULL,
    `filename`    VARCHAR(500) NOT NULL,
    `filesize`    VARCHAR(50)  NOT NULL DEFAULT '',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_meeting` (`meeting_id`),
    CONSTRAINT `fk_att_meeting`
        FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
