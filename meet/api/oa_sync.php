<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/oa_lib.php';

/* ─────────────────────────────────────────────────────────────
   RVC-ONE User-sync (admin)
   GET  → สถานะการซิงค์ล่าสุด
   POST {full?: bool} → ซิงค์ตอนนี้ (full = ดึงทั้งหมดใหม่, ไม่งั้น incremental)
   งานตั้งเวลา: php meet/cron/oa_sync.php [--full]
───────────────────────────────────────────────────────────── */

header('Content-Type: application/json; charset=utf-8');
requireRole(['admin']);

try {
    $db = getDB();
    match ($_SERVER['REQUEST_METHOD']) {
        'GET'  => jsonOk(oaSyncStatus($db)),
        'POST' => handleSync($db),
        default => jsonError('Method not allowed', 405),
    };
} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}

function handleSync(PDO $db): never
{
    $body = json_decode((string)file_get_contents('php://input'), true) ?? [];
    set_time_limit(600);
    session_write_close();   // ไม่ล็อก session ระหว่างซิงค์นาน ๆ

    try {
        $result = oaSync($db, (bool)($body['full'] ?? false));
    } catch (OaError $e) {
        /* ไม่ใช้ 5xx — proxy บางตัวแทน response ด้วยหน้า error ของตัวเอง */
        jsonError($e->getMessage(), $e->reason === 'busy' ? 409 : 400);
    }
    jsonOk($result + ['status' => oaSyncStatus($db)]);
}
