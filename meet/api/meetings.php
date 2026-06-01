<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$id     = trim($_GET['id'] ?? '');

try {
    $db = getDB();
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
        'SELECT meeting_id, filename, filesize FROM attachments ORDER BY id ASC'
    )->fetchAll();

    // Group attachments by meeting_id
    $attMap = [];
    foreach ($atts as $a) {
        $attMap[$a['meeting_id']][] = ['name' => $a['filename'], 'size' => $a['filesize']];
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

    // Accept client-generated id (from uid() in JSX) or generate one
    $id = preg_replace('/[^a-z0-9_-]/i', '', $d['id'] ?? '');
    if ($id === '') {
        $id = 'm' . bin2hex(random_bytes(4));
    }

    // Prevent duplicate id
    $chk = $db->prepare('SELECT id FROM meetings WHERE id = ?');
    $chk->execute([$id]);
    if ($chk->fetch()) {
        $id = 'm' . bin2hex(random_bytes(4));
    }

    $db->prepare(
        'INSERT INTO meetings
            (id, title, description, organizer, dept, invitees,
             start_time, end_time, platform, link, location)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $id,
        trim($d['title']       ?? ''),
        trim($d['description'] ?? ''),
        trim($d['organizer']   ?? ''),
        $d['dept']             ?? 'exec',
        trim($d['invitees']    ?? ''),
        isoToUtc($d['start']   ?? ''),
        isoToUtc($d['end']     ?? ''),
        $d['platform']         ?? 'meet',
        trim($d['link']        ?? ''),
        trim($d['location']    ?? ''),
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
            start_time=?, end_time=?, platform=?, link=?, location=?
         WHERE id=?'
    );
    $stmt->execute([
        trim($d['title']       ?? ''),
        trim($d['description'] ?? ''),
        trim($d['organizer']   ?? ''),
        $d['dept']             ?? 'exec',
        trim($d['invitees']    ?? ''),
        isoToUtc($d['start']   ?? ''),
        isoToUtc($d['end']     ?? ''),
        $d['platform']         ?? 'meet',
        trim($d['link']        ?? ''),
        trim($d['location']    ?? ''),
        $id,
    ]);

    if ($stmt->rowCount() === 0) {
        $chk = $db->prepare('SELECT id FROM meetings WHERE id=?');
        $chk->execute([$id]);
        if (!$chk->fetch()) jsonError('Meeting not found', 404);
    }

    $db->prepare('DELETE FROM attachments WHERE meeting_id=?')->execute([$id]);
    insertAttachments($db, $id, $d['attachments'] ?? []);
    jsonOk(fetchMeeting($db, $id));
}

function handleDelete(PDO $db, string $id): never
{
    requireRole(['admin', 'organizer']);
    if ($id === '') jsonError('Missing meeting id');

    $stmt = $db->prepare('DELETE FROM meetings WHERE id=?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        jsonError('Meeting not found', 404);
    }

    jsonOk(['deleted' => $id]);
}

/* ───────────────────── Helpers ───────────────────── */

function insertAttachments(PDO $db, string $meetingId, array $atts): void
{
    if (empty($atts)) return;
    $stmt = $db->prepare(
        'INSERT INTO attachments (meeting_id, filename, filesize) VALUES (?,?,?)'
    );
    foreach ($atts as $a) {
        $stmt->execute([$meetingId, trim($a['name'] ?? ''), trim($a['size'] ?? '')]);
    }
}

function fetchMeeting(PDO $db, string $id): array
{
    $stmt = $db->prepare('SELECT * FROM meetings WHERE id=?');
    $stmt->execute([$id]);
    $m = $stmt->fetch();
    if (!$m) jsonError('Meeting not found', 404);

    $aStmt = $db->prepare(
        'SELECT filename, filesize FROM attachments WHERE meeting_id=? ORDER BY id ASC'
    );
    $aStmt->execute([$id]);
    $atts = array_map(
        static fn($r) => ['name' => $r['filename'], 'size' => $r['filesize']],
        $aStmt->fetchAll()
    );

    return formatMeeting($m, $atts);
}
