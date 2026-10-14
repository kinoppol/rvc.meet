<?php
declare(strict_types=1);
/* ─────────────────────────────────────────────────────────────
   ซิงค์ผู้ใช้จาก RVC-ONE (สำหรับ cron)
     php meet/cron/oa_sync.php          → incremental (since จากรอบก่อน)
     php meet/cron/oa_sync.php --full   → ดึงทั้งหมดใหม่
   ตัวอย่าง crontab (ทุก 30 นาที):
     0,30 * * * * php /var/www/meet/meet/meet/cron/oa_sync.php >> /var/log/rvcmeet-oa-sync.log 2>&1
───────────────────────────────────────────────────────────── */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/oa_lib.php';

$full = in_array('--full', $argv, true);

try {
    $r = oaSync(getDB(), $full);
    printf("[%s] oa_sync ok (%s) pages=%d added=%d updated=%d suspended=%d unchanged=%d skipped=%d next_since=%s\n",
        gmdate('c'), $r['full'] ? 'full' : 'incremental', $r['pages'], $r['added'], $r['updated'],
        $r['suspended'], $r['unchanged'], $r['skipped'], $r['server_time'] ?? '-');
    exit(0);
} catch (\Throwable $e) {
    fprintf(STDERR, "[%s] oa_sync failed: %s\n", gmdate('c'), $e->getMessage());
    exit(1);
}
