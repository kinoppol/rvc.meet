<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);
requireAuth();

$body = jsonBody();
$mid  = trim($body['meeting_id'] ?? '');
if (!$mid) jsonError('Missing meeting_id', 400);

$user = $_SESSION['user'];
$db   = getDB();
$now  = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

$st = $db->prepare(
    "UPDATE attendance SET last_seen_at = ? WHERE meeting_id = ? AND user_id = ?"
);
$st->execute([$now, $mid, $user['id']]);

jsonOk(['ok' => true, 'ts' => $now]);
