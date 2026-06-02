<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

ensureAttendanceTable();

$method = $_SERVER['REQUEST_METHOD'];

/* ─── GET: list attendance for a meeting ─── */
if ($method === 'GET') {
    requireAuth();
    $mid = trim($_GET['meeting_id'] ?? '');
    if (!$mid) jsonError('Missing meeting_id', 400);
    $db = getDB();
    $st = $db->prepare(
        "SELECT id, meeting_id, user_id, name, location, is_absent, notes,
                lat, lng, signed_at, last_seen_at, added_by
         FROM attendance
         WHERE meeting_id = ?
         ORDER BY is_absent ASC, signed_at ASC"
    );
    $st->execute([$mid]);
    jsonOk($st->fetchAll());
}

/* ─── POST: self sign-in OR admin manual entry ─── */
if ($method === 'POST') {
    requireAuth();
    $body = jsonBody();
    $db   = getDB();
    $user = $_SESSION['user'];
    $mid  = trim($body['meeting_id'] ?? '');
    if (!$mid) jsonError('Missing meeting_id', 400);

    $isManual = !empty($body['is_manual']);
    $lat      = isset($body['lat']) && is_numeric($body['lat']) ? round((float)$body['lat'], 6) : null;
    $lng      = isset($body['lng']) && is_numeric($body['lng']) ? round((float)$body['lng'], 6) : null;

    if ($isManual) {
        requireRole(['admin', 'organizer']);
        $name     = trim($body['name']     ?? '');
        $location = trim($body['location'] ?? '');
        $isAbsent = !empty($body['is_absent']) ? 1 : 0;
        $notes    = trim($body['notes']    ?? '') ?: null;
        if (!$name) jsonError('กรุณาระบุชื่อ', 422);

        $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
        $st  = $db->prepare(
            "INSERT INTO attendance
                (meeting_id, user_id, name, location, is_absent, notes, lat, lng, signed_at, added_by)
             VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $st->execute([$mid, $name, $location, $isAbsent, $notes, $lat, $lng, $now, $user['id']]);
        $id = (int)$db->lastInsertId();

    } else {
        /* Self sign-in — validate meeting is currently live */
        $mSt = $db->prepare("SELECT start_time, end_time FROM meetings WHERE id = ?");
        $mSt->execute([$mid]);
        $m = $mSt->fetch();
        if (!$m) jsonError('ไม่พบการประชุม', 404);

        $tz    = new DateTimeZone('UTC');
        $now   = new DateTimeImmutable('now', $tz);
        $start = new DateTimeImmutable($m['start_time'], $tz);
        $end   = new DateTimeImmutable($m['end_time'],   $tz);
        if ($now < $start || $now > $end) {
            jsonError('ไม่สามารถลงชื่อได้ในขณะนี้ — การประชุมยังไม่เริ่มหรือสิ้นสุดแล้ว', 422);
        }

        $location = trim($body['location'] ?? '');
        $isAbsent = !empty($body['is_absent']) ? 1 : 0;
        $notes    = trim($body['notes']    ?? '') ?: null;
        $nowStr   = $now->format('Y-m-d H:i:s');

        /* Upsert: update if user already has a record for this meeting */
        $exSt = $db->prepare("SELECT id FROM attendance WHERE meeting_id = ? AND user_id = ?");
        $exSt->execute([$mid, $user['id']]);
        $ex = $exSt->fetch();
        if ($ex) {
            $db->prepare(
                "UPDATE attendance
                 SET location=?, is_absent=?, notes=?, lat=?, lng=?, signed_at=?, last_seen_at=?
                 WHERE id=?"
            )->execute([$location, $isAbsent, $notes, $lat, $lng, $nowStr, $nowStr, $ex['id']]);
            $id = (int)$ex['id'];
        } else {
            $db->prepare(
                "INSERT INTO attendance
                    (meeting_id, user_id, name, location, is_absent, notes, lat, lng, signed_at, last_seen_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([$mid, $user['id'], $user['name'], $location, $isAbsent, $notes, $lat, $lng, $nowStr, $nowStr]);
            $id = (int)$db->lastInsertId();
        }
    }

    $rowSt = $db->prepare("SELECT * FROM attendance WHERE id = ?");
    $rowSt->execute([$id]);
    jsonOk($rowSt->fetch(), 201);
}

/* ─── PUT: update an entry (admin / organizer) ─── */
if ($method === 'PUT') {
    requireRole(['admin', 'organizer']);
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonError('Missing id', 400);
    $body     = jsonBody();
    $name     = trim($body['name']     ?? '');
    $location = trim($body['location'] ?? '');
    $isAbsent = !empty($body['is_absent']) ? 1 : 0;
    $notes    = trim($body['notes']    ?? '') ?: null;
    if (!$name) jsonError('กรุณาระบุชื่อ', 422);
    $db = getDB();
    $db->prepare(
        "UPDATE attendance SET name=?, location=?, is_absent=?, notes=? WHERE id=?"
    )->execute([$name, $location, $isAbsent, $notes, $id]);
    $rowSt = $db->prepare("SELECT * FROM attendance WHERE id = ?");
    $rowSt->execute([$id]);
    jsonOk($rowSt->fetch());
}

/* ─── DELETE: remove an entry (admin / organizer) ─── */
if ($method === 'DELETE') {
    requireRole(['admin', 'organizer']);
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonError('Missing id', 400);
    getDB()->prepare("DELETE FROM attendance WHERE id = ?")->execute([$id]);
    jsonOk(['deleted' => $id]);
}

jsonError('Method not allowed', 405);

/* ─── Auto-migrate: create + upgrade attendance table ─── */
function ensureAttendanceTable(): void
{
    $db = getDB();
    $db->exec("CREATE TABLE IF NOT EXISTS `attendance` (
        `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
        `meeting_id`   VARCHAR(20)   NOT NULL,
        `user_id`      INT UNSIGNED  NULL     COMMENT 'null = manual entry',
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
        CONSTRAINT `fk_att_meet2`
            FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    /* Upgrade existing installs that lack the new columns */
    foreach ([
        "ALTER TABLE `attendance` ADD COLUMN IF NOT EXISTS `lat`          DECIMAL(9,6)  NULL AFTER `notes`",
        "ALTER TABLE `attendance` ADD COLUMN IF NOT EXISTS `lng`          DECIMAL(10,6) NULL AFTER `lat`",
        "ALTER TABLE `attendance` ADD COLUMN IF NOT EXISTS `last_seen_at` DATETIME      NULL AFTER `lng`",
    ] as $sql) {
        try { $db->exec($sql); } catch (\Throwable) {}
    }
}
