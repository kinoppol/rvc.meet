<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/schema_lib.php';

/* ─────────────────────────────────────────────────────────────
   Database structure (admin only)
   GET  → สถานะตาราง/คอลัมน์เทียบกับโครงสร้างที่ต้องการ
   POST → สร้างตาราง/คอลัมน์ที่ขาด
───────────────────────────────────────────────────────────── */

header('Content-Type: application/json; charset=utf-8');
requireRole(['admin']);

try {
    $db = getDB();
    match ($_SERVER['REQUEST_METHOD']) {
        'GET'   => jsonOk(schemaStatus($db)),
        'POST'  => jsonOk(['log' => schemaMigrate($db)] + schemaStatus($db)),
        default => jsonError('Method not allowed', 405),
    };
} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
