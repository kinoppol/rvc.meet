<?php
declare(strict_types=1);

/* ─────────────────────────────────────────────────────────────
   SimpleMeet — Web Installer
   สร้างฐานข้อมูล, ตาราง, ผู้ดูแลระบบ และข้อมูลตัวอย่าง
───────────────────────────────────────────────────────────── */

$errors  = [];
$success = false;
$done    = false;

/* ── System requirements ────────────────────────────────────── */
$checks = [
    ['label' => 'PHP 8.0+',      'ok' => PHP_MAJOR_VERSION >= 8,         'val' => PHP_VERSION],
    ['label' => 'PDO MySQL',     'ok' => extension_loaded('pdo_mysql'),   'val' => extension_loaded('pdo_mysql')  ? 'พร้อมใช้งาน' : 'ไม่พบ extension'],
    ['label' => 'JSON',          'ok' => extension_loaded('json'),        'val' => extension_loaded('json')       ? 'พร้อมใช้งาน' : 'ไม่พบ extension'],
    ['label' => 'เขียนไฟล์ api/', 'ok' => is_writable(__DIR__ . '/api'),  'val' => is_writable(__DIR__ . '/api')  ? 'อนุญาต'       : 'ไม่มีสิทธิ์เขียน'],
];
$canInstall = !in_array(false, array_column($checks, 'ok'), true);

/* ── Handle form submission ──────────────────────────────────── */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $canInstall) {

    $cfg = [
        'host' => trim($_POST['db_host'] ?? 'localhost'),
        'port' => (int)($_POST['db_port'] ?? 3306),
        'name' => trim($_POST['db_name'] ?? 'simplemeet'),
        'user' => trim($_POST['db_user'] ?? 'root'),
        'pass' => $_POST['db_pass']      ?? '',
    ];
    $admPerm = $_POST['adm_permission'] ?? 'admin';
    if (!in_array($admPerm, ['admin','organizer','staff'], true)) $admPerm = 'admin';
    $adm = [
        'username'   => trim($_POST['adm_user'] ?? 'admin'),
        'password'   => $_POST['adm_pass']      ?? '1234',
        'name'       => trim($_POST['adm_name'] ?? 'ผู้ดูแลระบบประชุม'),
        'role'       => trim($_POST['adm_role'] ?? 'เจ้าหน้าที่งานสารสนเทศ'),
        'permission' => $admPerm,
    ];

    try {
        /* 1. Connect (no DB selected yet) */
        $dsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $cfg['host'], $cfg['port']);
        $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");

        /* 2. Create database */
        $pdo->exec(sprintf(
            "CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
            addslashes($cfg['name'])
        ));
        $pdo->exec("USE `" . addslashes($cfg['name']) . "`");

        /* 3. Create tables */
        $pdo->exec("CREATE TABLE IF NOT EXISTS `users` (
            `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
            `username`      VARCHAR(100)  NOT NULL,
            `password_hash` VARCHAR(255)  NOT NULL,
            `name`          VARCHAR(200)  NOT NULL,
            `role`          VARCHAR(100)  NOT NULL DEFAULT '',
            `permission`    VARCHAR(20)   NOT NULL DEFAULT 'staff',
            `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_username` (`username`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        /* Upgrade: add permission column to existing installations */
        $pdo->exec("ALTER TABLE `users`
            ADD COLUMN IF NOT EXISTS `permission` VARCHAR(20) NOT NULL DEFAULT 'staff' AFTER `role`");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `meetings` (
            `id`          VARCHAR(20)   NOT NULL,
            `title`       VARCHAR(500)  NOT NULL,
            `description` TEXT,
            `organizer`   VARCHAR(200)  NOT NULL,
            `dept`        VARCHAR(50)   NOT NULL DEFAULT 'exec',
            `invitees`    TEXT,
            `start_time`  DATETIME      NOT NULL,
            `end_time`    DATETIME      NOT NULL,
            `platform`    VARCHAR(20)   NOT NULL DEFAULT 'meet',
            `link`        VARCHAR(1000) NOT NULL,
            `location`    VARCHAR(500)  DEFAULT NULL,
            `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_start` (`start_time`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `attachments` (
            `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `meeting_id`  VARCHAR(20)  NOT NULL,
            `filename`    VARCHAR(500) NOT NULL,
            `filesize`    VARCHAR(50)  NOT NULL DEFAULT '',
            `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_meeting` (`meeting_id`),
            CONSTRAINT `fk_att_meeting`
                FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `attendance` (
            `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
            `meeting_id` VARCHAR(20)   NOT NULL,
            `user_id`    INT UNSIGNED  NULL,
            `name`       VARCHAR(200)  NOT NULL,
            `location`   VARCHAR(500)  NOT NULL DEFAULT '',
            `is_absent`  TINYINT(1)    NOT NULL DEFAULT 0,
            `notes`      TEXT,
            `signed_at`  DATETIME      NOT NULL,
            `added_by`   INT UNSIGNED  NULL,
            PRIMARY KEY (`id`),
            KEY `idx_att_meet` (`meeting_id`),
            CONSTRAINT `fk_attendance_meeting`
                FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        /* 4. Admin user */
        $hash = password_hash($adm['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $pdo->prepare(
            "INSERT INTO users (username, password_hash, name, role, permission) VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
                password_hash=VALUES(password_hash),
                name=VALUES(name),
                role=VALUES(role),
                permission=VALUES(permission)"
        )->execute([$adm['username'], $hash, $adm['name'], $adm['role'], $adm['permission']]);

        /* 5. Seed data (relative to NOW() so statuses are immediately visible) */
        installSeed($pdo);

        /* 6. Write api/db.config.php */
        $configPHP = sprintf(
            "<?php\n// Auto-generated by install.php — do not edit manually\ndefined('DB_HOST') || define('DB_HOST', %s);\ndefined('DB_PORT') || define('DB_PORT', %d);\ndefined('DB_NAME') || define('DB_NAME', %s);\ndefined('DB_USER') || define('DB_USER', %s);\ndefined('DB_PASS') || define('DB_PASS', %s);\n",
            var_export($cfg['host'], true),
            $cfg['port'],
            var_export($cfg['name'], true),
            var_export($cfg['user'], true),
            var_export($cfg['pass'], true)
        );
        file_put_contents(__DIR__ . '/api/db.config.php', $configPHP);

        $success = true;

    } catch (Throwable $e) {
        $errors[] = $e->getMessage();
    }
}

/* ─────────────────────────────────────────────────────────────
   Seed data helper
───────────────────────────────────────────────────────────── */
function installSeed(PDO $pdo): void
{
    // Remove existing seed meetings to allow re-install
    $pdo->exec("DELETE FROM meetings WHERE id LIKE 'seed_%'");

    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $fmt = 'Y-m-d H:i:s';

    $meetings = [
        [
            'id'          => 'seed_live',
            'title'       => 'ประชุมคณะกรรมการบริหารสถานศึกษา ครั้งที่ 6/2569',
            'description' => 'พิจารณาแผนปฏิบัติการประจำปีงบประมาณ และติดตามผลการดำเนินงานไตรมาสที่ 3 ของแต่ละฝ่ายงาน',
            'organizer'   => 'ผู้อำนวยการสถานศึกษา',
            'dept'        => 'exec',
            'invitees'    => 'รองผู้อำนวยการทุกฝ่าย, หัวหน้าแผนกวิชา, หัวหน้างานที่เกี่ยวข้อง',
            'start_time'  => $now->modify('-25 minutes')->format($fmt),
            'end_time'    => $now->modify('+35 minutes')->format($fmt),
            'platform'    => 'meet',
            'link'        => 'https://meet.google.com/abc-defg-hij',
            'location'    => 'ห้องประชุมเกียรติยศ อาคารอำนวยการ (ประชุมแบบผสม)',
            'atts'        => [
                ['ระเบียบวาระการประชุม-6-2569.pdf', '248 KB'],
                ['รายงานผลไตรมาส3.pdf',             '1.2 MB'],
            ],
        ],
        [
            'id'          => 'seed_soon',
            'title'       => 'ประชุมเตรียมความพร้อมงานปัจฉิมนิเทศนักศึกษา',
            'description' => 'มอบหมายหน้าที่และซักซ้อมกำหนดการพิธีมอบประกาศนียบัตรผู้สำเร็จการศึกษา',
            'organizer'   => 'รองผู้อำนวยการฝ่ายพัฒนากิจการนักเรียนนักศึกษา',
            'dept'        => 'student',
            'invitees'    => 'คณะครูที่ปรึกษา, องค์การนักวิชาชีพฯ, งานกิจกรรม',
            'start_time'  => $now->modify('+70 minutes')->format($fmt),
            'end_time'    => $now->modify('+160 minutes')->format($fmt),
            'platform'    => 'zoom',
            'link'        => 'https://zoom.us/j/9876543210',
            'location'    => 'ออนไลน์ผ่านระบบ Zoom',
            'atts'        => [['กำหนดการปัจฉิมนิเทศ.pdf', '180 KB']],
        ],
        [
            'id'          => 'seed_ended',
            'title'       => 'ประชุมงานศูนย์ข้อมูลสารสนเทศ — วางระบบลงทะเบียนออนไลน์',
            'description' => 'สรุปความคืบหน้าการพัฒนาระบบและกำหนดแผนทดสอบก่อนเปิดภาคเรียน',
            'organizer'   => 'หัวหน้างานศูนย์ข้อมูลสารสนเทศ',
            'dept'        => 'it',
            'invitees'    => 'เจ้าหน้าที่งานสารสนเทศ, ตัวแทนงานทะเบียน',
            'start_time'  => $now->modify('-110 minutes')->format($fmt),
            'end_time'    => $now->modify('-20 minutes')->format($fmt),
            'platform'    => 'teams',
            'link'        => 'https://teams.microsoft.com/l/meetup-join/xyz',
            'location'    => 'ห้องปฏิบัติการคอมพิวเตอร์ 1',
            'atts'        => [],
        ],
        [
            'id'          => 'seed_today1',
            'title'       => 'ประชุมหัวหน้าแผนกวิชา ประจำเดือน',
            'description' => 'ติดตามการจัดการเรียนการสอนและการเบิกจ่ายวัสดุฝึกของแต่ละแผนกวิชา',
            'organizer'   => 'รองผู้อำนวยการฝ่ายวิชาการ',
            'dept'        => 'academic',
            'invitees'    => 'หัวหน้าแผนกวิชาทุกแผนก',
            'start_time'  => $now->setTime(16, 30, 0)->format($fmt),
            'end_time'    => $now->setTime(18,  0, 0)->format($fmt),
            'platform'    => 'meet',
            'link'        => 'https://meet.google.com/klm-nopq-rst',
            'location'    => 'ห้องประชุมวิชาการ ชั้น 2',
            'atts'        => [['วาระวิชาการ-มิย.pdf', '320 KB']],
        ],
        [
            'id'          => 'seed_tom1',
            'title'       => 'ประชุมจัดทำแผนปฏิบัติการและความร่วมมือสถานประกอบการ',
            'description' => 'ทบทวน MOU กับสถานประกอบการและวางแผนการนิเทศนักศึกษาฝึกงาน',
            'organizer'   => 'รองผู้อำนวยการฝ่ายแผนงานและความร่วมมือ',
            'dept'        => 'planning',
            'invitees'    => 'หัวหน้างานความร่วมมือ, ครูนิเทศ, ตัวแทนสถานประกอบการ',
            'start_time'  => $now->modify('+1 day')->setTime(9, 30, 0)->format($fmt),
            'end_time'    => $now->modify('+1 day')->setTime(11, 30, 0)->format($fmt),
            'platform'    => 'webex',
            'link'        => 'https://example.webex.com/meet/planning',
            'location'    => 'ออนไลน์ผ่าน Webex',
            'atts'        => [['ร่าง-MOU-2569.pdf', '540 KB']],
        ],
        [
            'id'          => 'seed_tom2',
            'title'       => 'ประชุมคณะกรรมการดำเนินงานประกันคุณภาพภายใน',
            'description' => 'เตรียมเอกสารและหลักฐานรองรับการประเมินคุณภาพภายในสถานศึกษา',
            'organizer'   => 'หัวหน้างานประกันคุณภาพฯ',
            'dept'        => 'planning',
            'invitees'    => 'คณะกรรมการประกันคุณภาพทุกท่าน',
            'start_time'  => $now->modify('+2 days')->setTime(13, 0, 0)->format($fmt),
            'end_time'    => $now->modify('+2 days')->setTime(15, 0, 0)->format($fmt),
            'platform'    => 'meet',
            'link'        => 'https://meet.google.com/qa-team-2569',
            'location'    => 'ห้องประชุมเล็ก อาคารอำนวยการ',
            'atts'        => [],
        ],
        [
            'id'          => 'seed_next1',
            'title'       => 'ประชุมเตรียมการรับสมัครนักเรียนนักศึกษาใหม่',
            'description' => 'วางแผนประชาสัมพันธ์และจัดทำปฏิทินการรับสมัครรอบโควตา',
            'organizer'   => 'รองผู้อำนวยการฝ่ายวิชาการ',
            'dept'        => 'academic',
            'invitees'    => 'งานทะเบียน, งานแนะแนว, หัวหน้าแผนกวิชา',
            'start_time'  => $now->modify('+3 days')->setTime(10, 0, 0)->format($fmt),
            'end_time'    => $now->modify('+3 days')->setTime(11, 30, 0)->format($fmt),
            'platform'    => 'zoom',
            'link'        => 'https://zoom.us/j/1122334455',
            'location'    => 'ออนไลน์ผ่าน Zoom',
            'atts'        => [['ปฏิทินรับสมัคร-2569.pdf', '210 KB']],
        ],
        [
            'id'          => 'seed_next2',
            'title'       => 'ประชุมฝ่ายบริหารทรัพยากร — สรุปการเบิกจ่ายงบประมาณ',
            'description' => 'รายงานสถานะการใช้จ่ายงบประมาณและพิจารณาแผนจัดซื้อจัดจ้างไตรมาสถัดไป',
            'organizer'   => 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร',
            'dept'        => 'admin',
            'invitees'    => 'งานการเงิน, งานพัสดุ, งานบุคลากร',
            'start_time'  => $now->modify('+5 days')->setTime(9, 0, 0)->format($fmt),
            'end_time'    => $now->modify('+5 days')->setTime(10, 30, 0)->format($fmt),
            'platform'    => 'other',
            'link'        => 'https://line.me/meeting/budget-room',
            'location'    => 'ห้องประชุมการเงิน',
            'atts'        => [],
        ],
    ];

    $mStmt = $pdo->prepare(
        'INSERT IGNORE INTO meetings
            (id, title, description, organizer, dept, invitees,
             start_time, end_time, platform, link, location)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    );
    $aStmt = $pdo->prepare(
        'INSERT IGNORE INTO attachments (meeting_id, filename, filesize) VALUES (?,?,?)'
    );

    foreach ($meetings as $m) {
        $mStmt->execute([
            $m['id'], $m['title'], $m['description'], $m['organizer'],
            $m['dept'], $m['invitees'], $m['start_time'], $m['end_time'],
            $m['platform'], $m['link'], $m['location'],
        ]);
        foreach ($m['atts'] as [$filename, $filesize]) {
            $aStmt->execute([$m['id'], $filename, $filesize]);
        }
    }
}

/* ─────────────────────────────────────────────────────────────
   HTML output
───────────────────────────────────────────────────────────── */
?><!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ติดตั้ง SimpleMeet</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="styles.css" />
<style>
  .inst-wrap { min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding: 48px 24px 80px; }
  .inst-card { width: 100%; max-width: 640px; }
  .req-row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
  .req-row:last-child { border-bottom: none; }
  .req-ic { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex: none; }
  .req-ok  { background: var(--green-50); color: var(--green); }
  .req-err { background: var(--red-50);   color: var(--red); }
  .req-label { flex: 1; font-weight: 600; color: var(--ink-2); }
  .req-val   { font-size: 13px; color: var(--muted); }
  .section-title { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--ink-2); margin: 0 0 14px; }
</style>
</head>
<body>
<div class="inst-wrap">
<div class="inst-card">

  <!-- Header -->
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;">
    <span style="width:48px;height:48px;border-radius:14px;background:var(--blue);display:inline-flex;align-items:center;justify-content:center;">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10l6-3.2v10.4l-6-3.2"/>
      </svg>
    </span>
    <div>
      <div style="font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:-.3px;">SimpleMeet</div>
      <div style="font-size:13px;color:var(--muted);">ระบบประชุมออนไลน์สถานศึกษา — ตัวติดตั้ง</div>
    </div>
  </div>

  <?php if ($success): ?>
  <!-- ── Success ── -->
  <div class="card" style="padding:32px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:20px;background:var(--green-50);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.6 2.6L16 9.5"/>
      </svg>
    </div>
    <h2 style="font-family:var(--font-display);font-size:24px;margin:0 0 10px;color:var(--green);">ติดตั้งสำเร็จ!</h2>
    <p class="muted" style="line-height:1.65;margin:0 0 24px;">สร้างฐานข้อมูล ตาราง ผู้ดูแลระบบ และข้อมูลตัวอย่างเรียบร้อยแล้ว<br>ลบไฟล์ <code>install.php</code> ออกหลังการติดตั้งเพื่อความปลอดภัย</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      <a href="index.html" class="btn btn-primary btn-lg">เปิดแอปพลิเคชัน →</a>
      <a href="install.php" class="btn btn-soft">ติดตั้งซ้ำ / รีเซ็ต Seed</a>
    </div>
  </div>

  <?php else: ?>

  <!-- ── Requirements ── -->
  <div class="card" style="padding:22px 24px;margin-bottom:20px;">
    <div class="section-title">ตรวจสอบความต้องการของระบบ</div>
    <?php foreach ($checks as $c): ?>
    <div class="req-row">
      <span class="req-ic <?= $c['ok'] ? 'req-ok' : 'req-err' ?>"><?= $c['ok'] ? '✓' : '✗' ?></span>
      <span class="req-label"><?= htmlspecialchars($c['label']) ?></span>
      <span class="req-val"><?= htmlspecialchars($c['val']) ?></span>
    </div>
    <?php endforeach; ?>
  </div>

  <?php if (!$canInstall): ?>
  <div class="card" style="padding:18px 22px;background:var(--red-50);border-color:var(--red);margin-bottom:20px;">
    <strong style="color:var(--red);">ไม่สามารถติดตั้งได้</strong>
    <div class="muted" style="margin-top:4px;font-size:13.5px;">กรุณาแก้ไขปัญหาด้านบนแล้วโหลดหน้านี้ใหม่</div>
  </div>
  <?php else: ?>

  <!-- ── Error display ── -->
  <?php if (!empty($errors)): ?>
  <div class="card" style="padding:16px 20px;background:var(--red-50);border-color:var(--red);margin-bottom:20px;">
    <strong style="color:var(--red);">เกิดข้อผิดพลาด</strong>
    <?php foreach ($errors as $e): ?>
    <div style="margin-top:6px;font-size:13.5px;color:var(--red);"><?= htmlspecialchars($e) ?></div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>

  <!-- ── Install form ── -->
  <form method="POST">
    <!-- Database config -->
    <div class="card" style="padding:24px;margin-bottom:20px;">
      <div class="section-title">การเชื่อมต่อฐานข้อมูล</div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr;">
        <div class="field">
          <label>Host <span class="req">*</span></label>
          <input class="input" name="db_host" value="<?= htmlspecialchars($_POST['db_host'] ?? 'localhost') ?>" required />
        </div>
        <div class="field">
          <label>Port <span class="req">*</span></label>
          <input class="input" name="db_port" type="number" value="<?= htmlspecialchars($_POST['db_port'] ?? '3306') ?>" required />
        </div>
        <div class="field">
          <label>ชื่อฐานข้อมูล <span class="req">*</span></label>
          <input class="input" name="db_name" value="<?= htmlspecialchars($_POST['db_name'] ?? 'simplemeet') ?>" required />
          <span class="hint">จะสร้างให้อัตโนมัติถ้ายังไม่มี</span>
        </div>
        <div class="field">
          <label>ชื่อผู้ใช้ฐานข้อมูล <span class="req">*</span></label>
          <input class="input" name="db_user" value="<?= htmlspecialchars($_POST['db_user'] ?? 'root') ?>" required />
        </div>
        <div class="field col-2">
          <label>รหัสผ่านฐานข้อมูล</label>
          <input class="input" name="db_pass" type="password" value="" placeholder="เว้นว่างถ้าไม่มีรหัสผ่าน (XAMPP default)" />
        </div>
      </div>
    </div>

    <!-- Admin config -->
    <div class="card" style="padding:24px;margin-bottom:20px;">
      <div class="section-title">บัญชีผู้ดูแลระบบ</div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr;">
        <div class="field">
          <label>ชื่อผู้ใช้ <span class="req">*</span></label>
          <input class="input" name="adm_user" value="<?= htmlspecialchars($_POST['adm_user'] ?? 'admin') ?>" required />
        </div>
        <div class="field">
          <label>รหัสผ่าน <span class="req">*</span></label>
          <input class="input" name="adm_pass" type="password" value="<?= htmlspecialchars($_POST['adm_pass'] ?? '1234') ?>" required />
        </div>
        <div class="field">
          <label>ชื่อแสดง <span class="req">*</span></label>
          <input class="input" name="adm_name" value="<?= htmlspecialchars($_POST['adm_name'] ?? 'ผู้ดูแลระบบประชุม') ?>" required />
        </div>
        <div class="field">
          <label>ตำแหน่ง / ฝ่ายงาน</label>
          <input class="input" name="adm_role" value="<?= htmlspecialchars($_POST['adm_role'] ?? 'เจ้าหน้าที่งานสารสนเทศ') ?>" />
        </div>
        <div class="field">
          <label>ประเภทผู้ใช้ <span class="req">*</span></label>
          <select class="select" name="adm_permission">
            <?php
            $selPerm = $_POST['adm_permission'] ?? 'admin';
            foreach (['admin'=>'ผู้ดูแลระบบ','organizer'=>'ผู้กำหนดการประชุม','staff'=>'บุคลากรทั่วไป'] as $val=>$lbl):
            ?>
            <option value="<?= $val ?>"<?= $selPerm===$val?' selected':'' ?>><?= $lbl ?></option>
            <?php endforeach; ?>
          </select>
          <span class="hint">ผู้ดูแลระบบ: จัดการผู้ใช้ + ประชุม · ผู้กำหนดการประชุม: จัดการประชุม · บุคลากรทั่วไป: เข้าร่วมเท่านั้น</span>
        </div>
      </div>
    </div>

    <div class="card" style="padding:16px 22px;background:var(--amber-50);border-color:var(--amber);margin-bottom:20px;font-size:14px;">
      <strong>หมายเหตุ:</strong> การติดตั้งจะ<strong>เพิ่มข้อมูลตัวอย่าง</strong> 8 รายการประชุม (ทุกสถานะ) เพื่อทดสอบระบบ
      การติดตั้งซ้ำจะ reset seed data แต่ไม่ลบข้อมูลที่สร้างขึ้นใหม่
    </div>

    <button type="submit" class="btn btn-primary btn-lg btn-block">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      ติดตั้ง SimpleMeet
    </button>
  </form>

  <?php endif; ?>
  <?php endif; ?>

</div><!-- .inst-card -->
</div><!-- .inst-wrap -->
</body>
</html>
