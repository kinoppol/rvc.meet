<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

requireRole(['admin', 'organizer']);

$db        = getDB();
$mid       = trim($_GET['meeting_id'] ?? '');
$excludeId = (int)($_GET['exclude_id'] ?? 0); // for edit: keep current record's name eligible

/* ── All registered users ── */
$users = $db->query(
    "SELECT name FROM users ORDER BY name"
)->fetchAll(PDO::FETCH_COLUMN);

/* ── Distinct names from past attendance (other meetings) ── */
$past = [];
try {
    if ($mid) {
        /* Exclude names already in THIS meeting (except the record being edited) */
        $sql  = $excludeId
            ? "SELECT DISTINCT name FROM attendance WHERE meeting_id != ? OR id = ? ORDER BY name"
            : "SELECT DISTINCT name FROM attendance WHERE meeting_id != ? ORDER BY name";
        $stmt = $db->prepare($sql);
        $excludeId ? $stmt->execute([$mid, $excludeId]) : $stmt->execute([$mid]);
    } else {
        $stmt = $db->query("SELECT DISTINCT name FROM attendance ORDER BY name");
    }
    $past = $stmt->fetchAll(PDO::FETCH_COLUMN);
} catch (\Throwable) {}

/* ── Names already in this meeting (to exclude) ── */
$existing = [];
if ($mid) {
    try {
        $exSql  = $excludeId
            ? "SELECT name FROM attendance WHERE meeting_id = ? AND id != ?"
            : "SELECT name FROM attendance WHERE meeting_id = ?";
        $exStmt = $db->prepare($exSql);
        $excludeId ? $exStmt->execute([$mid, $excludeId]) : $exStmt->execute([$mid]);
        $existing = array_map('mb_strtolower', $exStmt->fetchAll(PDO::FETCH_COLUMN));
    } catch (\Throwable) {}
}

/* ── Merge users + past attendees, filter out already-in-meeting names ── */
$merged = array_unique(array_map('trim', array_merge($users, $past)));
$merged = array_filter($merged, function ($name) use ($existing) {
    return $name !== '' && !in_array(mb_strtolower($name), $existing, true);
});
usort($merged, 'strcmp');

jsonOk(array_values($merged));
