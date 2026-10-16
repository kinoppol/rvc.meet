<?php
declare(strict_types=1);
/* ─────────────────────────────────────────────────────────────
   โครงสร้างฐานข้อมูลที่ระบบต้องการ (ที่เดียวสำหรับตรวจ/ปรับโครงสร้าง)
   - schemaTables():  ตารางทั้งหมด เรียงตามลำดับ FK
   - schemaColumns(): คอลัมน์ที่เพิ่มภายหลัง (สำหรับฐานข้อมูลรุ่นเก่า)
   เพิ่มตาราง/คอลัมน์ใหม่ → เพิ่มที่นี่ แล้วกด "ปรับโครงสร้าง" ในหน้าตั้งค่า
───────────────────────────────────────────────────────────── */

function schemaTables(): array
{
    $opt = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    return [
        'users' => "CREATE TABLE IF NOT EXISTS `users` (
            `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
            `username`      VARCHAR(100)  NOT NULL,
            `password_hash` VARCHAR(255)  NOT NULL,
            `name`          VARCHAR(200)  NOT NULL,
            `role`          VARCHAR(100)  NOT NULL DEFAULT '',
            `permission`    VARCHAR(20)   NOT NULL DEFAULT 'staff',
            `oa_user_id`    INT UNSIGNED  NULL DEFAULT NULL,
            `active`        TINYINT(1)    NOT NULL DEFAULT 1,
            `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_username` (`username`),
            UNIQUE KEY `uq_oa_user` (`oa_user_id`)
        ) $opt",

        'meetings' => "CREATE TABLE IF NOT EXISTS `meetings` (
            `id`              VARCHAR(20)   NOT NULL,
            `title`           VARCHAR(500)  NOT NULL,
            `description`     TEXT,
            `organizer`       VARCHAR(200)  NOT NULL,
            `dept`            VARCHAR(50)   NOT NULL DEFAULT 'exec',
            `invitees`        TEXT,
            `start_time`      DATETIME      NOT NULL,
            `end_time`        DATETIME      NOT NULL,
            `platform`        VARCHAR(20)   NOT NULL DEFAULT 'meet',
            `link`            VARCHAR(1000) NOT NULL,
            `location`        VARCHAR(500)  DEFAULT NULL,
            `drinks_enabled`  TINYINT(1)    NOT NULL DEFAULT 0,
            `drink_shop`      VARCHAR(200)  NOT NULL DEFAULT '',
            `drink_budget`    INT           NOT NULL DEFAULT 0,
            `drink_max_cups`  INT           NOT NULL DEFAULT 0,
            `google_event_id` VARCHAR(255)  DEFAULT NULL,
            `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_start` (`start_time`)
        ) $opt",

        'attachments' => "CREATE TABLE IF NOT EXISTS `attachments` (
            `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
            `meeting_id`  VARCHAR(20)   NOT NULL,
            `filename`    VARCHAR(500)  NOT NULL,
            `filesize`    VARCHAR(50)   NOT NULL DEFAULT '',
            `stored_name` VARCHAR(80)   DEFAULT NULL,
            `link_url`    VARCHAR(2048) DEFAULT NULL,
            `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_meeting` (`meeting_id`),
            CONSTRAINT `fk_att_meeting`
                FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) $opt",

        'attendance' => "CREATE TABLE IF NOT EXISTS `attendance` (
            `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
            `meeting_id`   VARCHAR(20)   NOT NULL,
            `user_id`      INT UNSIGNED  NULL,
            `name`         VARCHAR(200)  NOT NULL,
            `location`     VARCHAR(500)  NOT NULL DEFAULT '',
            `is_absent`    TINYINT(1)    NOT NULL DEFAULT 0,
            `notes`        TEXT,
            `lat`          DECIMAL(9,6)  NULL,
            `lng`          DECIMAL(10,6) NULL,
            `signed_at`    DATETIME      NOT NULL,
            `last_seen_at` DATETIME      NULL,
            `added_by`     INT UNSIGNED  NULL,
            PRIMARY KEY (`id`),
            KEY `idx_att_meet` (`meeting_id`),
            CONSTRAINT `fk_attendance_meeting`
                FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) $opt",

        'drinks' => "CREATE TABLE IF NOT EXISTS `drinks` (
            `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `name`         VARCHAR(200) NOT NULL,
            `sort_order`   INT          NOT NULL DEFAULT 0,
            `is_available` TINYINT(1)   NOT NULL DEFAULT 1,
            `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) $opt",

        'drink_orders' => "CREATE TABLE IF NOT EXISTS `drink_orders` (
            `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `meeting_id` VARCHAR(20)  NOT NULL,
            `user_id`    INT UNSIGNED NULL,
            `name`       VARCHAR(200) NOT NULL,
            `items`      JSON         NOT NULL,
            `notes`      TEXT,
            `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_meeting` (`meeting_id`),
            CONSTRAINT `fk_dorder_meeting`
                FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON DELETE CASCADE
        ) $opt",

        'rms_sync_log' => "CREATE TABLE IF NOT EXISTS `rms_sync_log` (
            `id`        INT AUTO_INCREMENT PRIMARY KEY,
            `synced_at` DATETIME    NOT NULL,
            `data_hash` VARCHAR(32) NOT NULL,
            `added`     INT DEFAULT 0,
            `updated`   INT DEFAULT 0,
            `deleted`   INT DEFAULT 0,
            `skipped`   INT DEFAULT 0
        ) $opt",

        'app_settings' => "CREATE TABLE IF NOT EXISTS `app_settings` (
            `k`          VARCHAR(64) NOT NULL,
            `v`          TEXT,
            `updated_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`k`)
        ) $opt",
    ];
}

/**
 * คอลัมน์ที่เพิ่มเข้ามาภายหลัง — [table, column, definition, after-SQL (optional)]
 * ตารางที่สร้างใหม่จาก schemaTables() จะมีคอลัมน์เหล่านี้อยู่แล้ว
 */
function schemaColumns(): array
{
    return [
        /* ผู้ใช้เดิมก่อนมีระบบสิทธิ์จัดการได้ทุกอย่าง → ให้เป็น admin */
        ['users',       'permission',      "VARCHAR(20) NOT NULL DEFAULT 'staff' AFTER `role`",
                                           "UPDATE `users` SET `permission`='admin'"],
        /* RVC-ONE SSO / user-sync (oa_user_id = id ผู้ใช้ใน RVC-ONE, active = 0 เมื่อถูกระงับ) */
        ['users',       'oa_user_id',      'INT UNSIGNED NULL DEFAULT NULL AFTER `permission`',
                                           'ALTER TABLE `users` ADD UNIQUE INDEX IF NOT EXISTS `uq_oa_user` (`oa_user_id`)'],
        ['users',       'active',          'TINYINT(1) NOT NULL DEFAULT 1 AFTER `oa_user_id`'],
        ['meetings',    'drinks_enabled',  'TINYINT(1) NOT NULL DEFAULT 0'],
        ['meetings',    'drink_shop',      "VARCHAR(200) NOT NULL DEFAULT ''"],
        ['meetings',    'drink_budget',    'INT NOT NULL DEFAULT 0'],
        ['meetings',    'drink_max_cups',  'INT NOT NULL DEFAULT 0'],
        ['meetings',    'google_event_id', 'VARCHAR(255) DEFAULT NULL'],
        ['attachments', 'stored_name',     'VARCHAR(80) DEFAULT NULL'],
        ['attachments', 'link_url',        'VARCHAR(2048) DEFAULT NULL'],
        ['attendance',  'lat',             'DECIMAL(9,6) NULL AFTER `notes`'],
        ['attendance',  'lng',             'DECIMAL(10,6) NULL AFTER `lat`'],
        ['attendance',  'last_seen_at',    'DATETIME NULL AFTER `lng`'],
    ];
}

/** ตรวจโครงสร้างจริงเทียบกับที่ต้องการ */
function schemaStatus(PDO $db): array
{
    $rows = $db->query(
        "SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH + INDEX_LENGTH AS size
           FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()"
    )->fetchAll();
    $existing = [];
    foreach ($rows as $r) $existing[$r['TABLE_NAME']] = $r;

    $cols = [];
    foreach ($db->query(
        "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()"
    )->fetchAll() as $c) {
        $cols[$c['TABLE_NAME']][$c['COLUMN_NAME']] = true;
    }

    $tables = [];
    foreach (array_keys(schemaTables()) as $t) {
        $missingCols = [];
        foreach (schemaColumns() as [$ct, $cc]) {
            if ($ct === $t && isset($existing[$t]) && empty($cols[$t][$cc])) $missingCols[] = $cc;
        }
        $tables[] = [
            'name'            => $t,
            'exists'          => isset($existing[$t]),
            'rows'            => isset($existing[$t]) ? (int)$existing[$t]['TABLE_ROWS'] : 0,
            'size'            => isset($existing[$t]) ? (int)$existing[$t]['size'] : 0,
            'columns'         => isset($cols[$t]) ? count($cols[$t]) : 0,
            'missing_columns' => $missingCols,
        ];
    }
    $pending = count(array_filter($tables, fn($t) => !$t['exists'] || $t['missing_columns']));

    return [
        'database' => (string)$db->query('SELECT DATABASE()')->fetchColumn(),
        'version'  => (string)$db->query('SELECT VERSION()')->fetchColumn(),
        'tables'   => $tables,
        'extra'    => array_values(array_diff(array_keys($existing), array_keys(schemaTables()))),
        'pending'  => $pending,
    ];
}

/** สร้างตาราง/คอลัมน์ที่ขาด → คืน log ของคำสั่งที่รัน */
function schemaMigrate(PDO $db): array
{
    $before = schemaStatus($db);
    $exists = array_column($before['tables'], 'exists', 'name');
    $log    = [];

    foreach (schemaTables() as $t => $sql) {
        if (!$exists[$t]) {
            $db->exec($sql);
            $log[] = "สร้างตาราง `$t`";
        }
    }
    foreach (schemaColumns() as $c) {
        [$t, $col, $def] = $c;
        if (!$exists[$t]) continue;   // เพิ่งสร้างใหม่ มีคอลัมน์ครบแล้ว
        $has = $db->prepare(
            'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?'
        );
        $has->execute([$t, $col]);
        if ($has->fetchColumn()) continue;

        $db->exec("ALTER TABLE `$t` ADD COLUMN `$col` $def");
        if (!empty($c[3])) $db->exec($c[3]);
        $log[] = "เพิ่มคอลัมน์ `$t`.`$col`";
    }
    return $log;
}
