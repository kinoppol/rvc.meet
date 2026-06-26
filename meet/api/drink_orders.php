<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$id     = (int)($_GET['id'] ?? 0);

try {
    $db = getDB();
    match ($method) {
        'GET'    => handleGet($db),
        'POST'   => handlePost($db),
        'DELETE' => handleDelete($db, $id),
        default  => jsonError('Method not allowed', 405),
    };
} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}

function handleGet(PDO $db): never
{
    requireAuth();
    $meetingId = trim($_GET['meeting_id'] ?? '');
    if ($meetingId === '') jsonError('Missing meeting_id', 422);

    $mine   = !empty($_GET['mine']);
    $userId = $_SESSION['user']['id'] ?? null;
    $perm   = $_SESSION['user']['permission'] ?? 'staff';

    if ($mine || $perm === 'staff') {
        // staff can only see their own order
        $stmt = $db->prepare('SELECT * FROM drink_orders WHERE meeting_id=? AND user_id=? ORDER BY id ASC');
        $stmt->execute([$meetingId, $userId]);
    } else {
        $stmt = $db->prepare('SELECT * FROM drink_orders WHERE meeting_id=? ORDER BY id ASC');
        $stmt->execute([$meetingId]);
    }

    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['id']      = (int)$r['id'];
        $r['user_id'] = $r['user_id'] ? (int)$r['user_id'] : null;
        $r['items']   = json_decode($r['items'], true) ?? [];
    }
    jsonOk($rows);
}

function handlePost(PDO $db): never
{
    requireRole(['admin', 'organizer', 'staff']);
    $d         = jsonBody();
    $meetingId = trim($d['meeting_id'] ?? '');
    $name      = trim($d['name'] ?? '');
    $items     = $d['items'] ?? [];
    $notes     = trim($d['notes'] ?? '');

    if ($meetingId === '') jsonError('Missing meeting_id', 422);
    if ($name === '')      jsonError('ต้องระบุชื่อผู้สั่ง', 422);
    if (empty($items))     jsonError('ต้องระบุรายการเครื่องดื่มอย่างน้อย 1 รายการ', 422);

    // Validate meeting exists and ordering window
    $mStmt = $db->prepare('SELECT start_time, drinks_enabled FROM meetings WHERE id=?');
    $mStmt->execute([$meetingId]);
    $meeting = $mStmt->fetch();
    if (!$meeting) jsonError('Meeting not found', 404);
    if (!$meeting['drinks_enabled']) jsonError('การสั่งเครื่องดื่มไม่ได้เปิดใช้งานสำหรับการประชุมนี้', 403);

    $startTs = strtotime($meeting['start_time'] . ' UTC');
    if (time() >= $startTs) jsonError('หมดเวลาสั่งเครื่องดื่มแล้ว', 403);

    $userId = $_SESSION['user']['id'] ?? null;

    // Upsert: delete existing order then insert
    $db->prepare('DELETE FROM drink_orders WHERE meeting_id=? AND user_id=?')->execute([$meetingId, $userId]);

    $db->prepare('INSERT INTO drink_orders (meeting_id, user_id, name, items, notes) VALUES (?,?,?,?,?)')
       ->execute([$meetingId, $userId, $name, json_encode($items, JSON_UNESCAPED_UNICODE), $notes]);

    $newId = (int)$db->lastInsertId();
    $row   = $db->prepare('SELECT * FROM drink_orders WHERE id=?');
    $row->execute([$newId]);
    $r = $row->fetch();
    $r['id']      = (int)$r['id'];
    $r['user_id'] = $r['user_id'] ? (int)$r['user_id'] : null;
    $r['items']   = json_decode($r['items'], true) ?? [];
    jsonOk($r, 201);
}

function handleDelete(PDO $db, int $id): never
{
    requireAuth();
    if ($id === 0) jsonError('Missing order id');

    $userId = $_SESSION['user']['id'] ?? null;
    $perm   = $_SESSION['user']['permission'] ?? 'staff';

    $row = $db->prepare('SELECT user_id FROM drink_orders WHERE id=?');
    $row->execute([$id]);
    $order = $row->fetch();
    if (!$order) jsonError('Order not found', 404);

    if ($perm !== 'admin' && (int)$order['user_id'] !== (int)$userId) {
        jsonError('Forbidden', 403);
    }

    $db->prepare('DELETE FROM drink_orders WHERE id=?')->execute([$id]);
    jsonOk(['deleted' => $id]);
}
