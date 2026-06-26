<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$id     = trim($_GET['id'] ?? '');

try {
    $db = getDB();
    ensureAttachmentStoredName($db);
    ensureDrinksColumn($db);
    match ($method) {
        'GET'    => handleGet($db),
        'POST'   => handlePost($db),
        'PUT'    => handlePut($db, $id),
        'DELETE' => handleDelete($db, $id),
        default  => jsonError('Method not allowed', 405),
    };
} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}

/* ───────────────────── Handlers ───────────────────── */

function handleGet(PDO $db): never
{
    $meetings = $db->query(
        'SELECT * FROM meetings ORDER BY start_time ASC'
    )->fetchAll();

    $atts = $db->query(
        'SELECT meeting_id, filename, filesize, stored_name, link_url FROM attachments ORDER BY id ASC'
    )->fetchAll();

    $attMap = [];
    foreach ($atts as $a) {
        $attMap[$a['meeting_id']][] = attRow($a);
    }

    $result = array_map(
        static fn(array $m) => formatMeeting($m, $attMap[$m['id']] ?? []),
        $meetings
    );

    jsonOk($result);
}

function handlePost(PDO $db): never
{
    requireRole(['admin', 'organizer']);
    $d = jsonBody();

    $id = preg_replace('/[^a-z0-9_-]/i', '', $d['id'] ?? '');
    if ($id === '') $id = 'm' . bin2hex(random_bytes(4));

    $chk = $db->prepare('SELECT id FROM meetings WHERE id = ?');
    $chk->execute([$id]);
    if ($chk->fetch()) $id = 'm' . bin2hex(random_bytes(4));

    $db->prepare(
        'INSERT INTO meetings
            (id, title, description, organizer, dept, invitees,
             start_time, end_time, platform, link, location, drinks_enabled)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $id,
        trim($d['title']       ?? ''),
        trim($d['description'] ?? ''),
        trim($d['organizer']   ?? ''),
        $d['dept']             ?? 'director',
        trim($d['invitees']    ?? ''),
        isoToUtc($d['start']   ?? ''),
        isoToUtc($d['end']     ?? ''),
        $d['platform']         ?? 'meet',
        trim($d['link']        ?? ''),
        trim($d['location']    ?? ''),
        empty($d['drinks_enabled']) ? 0 : 1,
    ]);

    insertAttachments($db, $id, $d['attachments'] ?? []);
    jsonOk(fetchMeeting($db, $id), 201);
}

function handlePut(PDO $db, string $id): never
{
    requireRole(['admin', 'organizer']);
    if ($id === '') jsonError('Missing meeting id');

    $d = jsonBody();

    $stmt = $db->prepare(
        'UPDATE meetings SET
            title=?, description=?, organizer=?, dept=?, invitees=?,
            start_time=?, end_time=?, platform=?, link=?, location=?, drinks_enabled=?
         WHERE id=?'
    );
    $stmt->execute([
        trim($d['title']       ?? ''),
        trim($d['description'] ?? ''),
        trim($d['organizer']   ?? ''),
        $d['dept']             ?? 'director',
        trim($d['invitees']    ?? ''),
        isoToUtc($d['start']   ?? ''),
        isoToUtc($d['end']     ?? ''),
        $d['platform']         ?? 'meet',
        trim($d['link']        ?? ''),
        trim($d['location']    ?? ''),
        empty($d['drinks_enabled']) ? 0 : 1,
        $id,
    ]);

    if ($stmt->rowCount() === 0) {
        $chk = $db->prepare('SELECT id FROM meetings WHERE id=?');
        $chk->execute([$id]);
        if (!$chk->fetch()) jsonError('Meeting not found', 404);
    }

    /* Delete old attachments that are no longer in the list, keeping files on disk if re-referenced */
    $keepNames = array_filter(array_map(fn($a) => trim($a['stored_name'] ?? ''), $d['attachments'] ?? []));
    $oldStmt   = $db->prepare('SELECT stored_name FROM attachments WHERE meeting_id=?');
    $oldStmt->execute([$id]);
    foreach ($oldStmt->fetchAll(PDO::FETCH_COLUMN) as $sn) {
        if ($sn && !in_array($sn, $keepNames, true)) {
            $path = __DIR__ . '/../uploads/' . basename($sn);
            if (file_exists($path)) @unlink($path);
        }
    }

    $db->prepare('DELETE FROM attachments WHERE meeting_id=?')->execute([$id]);
    insertAttachments($db, $id, $d['attachments'] ?? []);
    jsonOk(fetchMeeting($db, $id));
}

function handleDelete(PDO $db, string $id): never
{
    requireRole(['admin', 'organizer']);
    if ($id === '') jsonError('Missing meeting id');

    /* Remove uploaded files before deleting the meeting */
    $aStmt = $db->prepare('SELECT stored_name FROM attachments WHERE meeting_id=?');
    $aStmt->execute([$id]);
    foreach ($aStmt->fetchAll(PDO::FETCH_COLUMN) as $sn) {
        if ($sn) {
            $path = __DIR__ . '/../uploads/' . basename($sn);
            if (file_exists($path)) @unlink($path);
        }
    }

    $stmt = $db->prepare('DELETE FROM meetings WHERE id=?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('Meeting not found', 404);

    jsonOk(['deleted' => $id]);
}

/* ───────────────────── Helpers ───────────────────── */

function ensureAttachmentStoredName(PDO $db): void
{
    try {
        $db->exec("ALTER TABLE attachments ADD COLUMN IF NOT EXISTS stored_name VARCHAR(80) DEFAULT NULL");
        $db->exec("ALTER TABLE attachments ADD COLUMN IF NOT EXISTS link_url VARCHAR(2048) DEFAULT NULL");
    } catch (\Throwable) {}
}

function ensureDrinksColumn(PDO $db): void
{
    try {
        $db->exec("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS drinks_enabled TINYINT(1) NOT NULL DEFAULT 0");
        $db->exec("CREATE TABLE IF NOT EXISTS `drinks` (
            `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `name`         VARCHAR(200) NOT NULL,
            `sort_order`   INT NOT NULL DEFAULT 0,
            `is_available` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $db->exec("CREATE TABLE IF NOT EXISTS `drink_orders` (
            `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `meeting_id` VARCHAR(20)  NOT NULL,
            `user_id`    INT UNSIGNED NULL,
            `name`       VARCHAR(200) NOT NULL,
            `items`      JSON NOT NULL,
            `notes`      TEXT,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_meeting` (`meeting_id`),
            CONSTRAINT `fk_dorder_meeting` FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (\Throwable) {}
}

function attRow(array $a): array
{
    $isLink = !empty($a['link_url']);
    return [
        'name'        => $a['filename'],
        'size'        => $a['filesize'],
        'stored_name' => $a['stored_name'] ?? null,
        'url'         => $isLink ? $a['link_url'] : ($a['stored_name'] ? 'uploads/' . $a['stored_name'] : null),
        'is_link'     => $isLink,
    ];
}

function insertAttachments(PDO $db, string $meetingId, array $atts): void
{
    if (empty($atts)) return;
    $stmt = $db->prepare(
        'INSERT INTO attachments (meeting_id, filename, filesize, stored_name, link_url) VALUES (?,?,?,?,?)'
    );
    foreach ($atts as $a) {
        $stmt->execute([
            $meetingId,
            trim($a['name']         ?? ''),
            trim($a['size']         ?? ''),
            empty($a['is_link']) ? (trim($a['stored_name'] ?? '') ?: null) : null,
            !empty($a['is_link'])   ? trim($a['url'] ?? '') : null,
        ]);
    }
}

function fetchMeeting(PDO $db, string $id): array
{
    $stmt = $db->prepare('SELECT * FROM meetings WHERE id=?');
    $stmt->execute([$id]);
    $m = $stmt->fetch();
    if (!$m) jsonError('Meeting not found', 404);

    $aStmt = $db->prepare(
        'SELECT filename, filesize, stored_name, link_url FROM attachments WHERE meeting_id=? ORDER BY id ASC'
    );
    $aStmt->execute([$id]);
    $atts = array_map('attRow', $aStmt->fetchAll());

    return formatMeeting($m, $atts);
}
