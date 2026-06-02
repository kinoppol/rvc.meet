<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rms_config.php';

header('Content-Type: application/json; charset=utf-8');

requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();
ensureRmsSyncTable($db);

if ($method === 'GET') {
    /* ── ตรวจสอบ auto-sync: คืนสถานะและ sync ถ้าเกิน interval ── */
    $log = getLastLog($db);
    jsonOk([
        'last_synced_at' => $log['synced_at']   ?? null,
        'last_hash'      => $log['data_hash']    ?? null,
        'added'          => (int)($log['added']   ?? 0),
        'updated'        => (int)($log['updated'] ?? 0),
        'deleted'        => (int)($log['deleted'] ?? 0),
        'skipped'        => (int)($log['skipped'] ?? 0),
        'interval_sec'   => RMS_AUTO_SYNC_INTERVAL,
    ]);
}

if ($method === 'POST') {
    $body  = json_decode((string)file_get_contents('php://input'), true) ?? [];
    $force = (bool)($body['force'] ?? false);

    /* ── ดึงข้อมูลจาก RMS ── */
    $url      = rtrim(RMS_BASE_URL, '/') . '/' . ltrim(RMS_PEOPLE_PATH, '/');
    $ctx      = stream_context_create(['http' => ['timeout' => 15, 'ignore_errors' => true]]);
    $raw      = @file_get_contents($url, false, $ctx);

    if ($raw === false) {
        jsonError('ไม่สามารถเชื่อมต่อ RMS ได้: ' . $url, 502);
    }

    $people = json_decode($raw, true);
    if (!is_array($people)) {
        jsonError('RMS ส่งข้อมูลไม่ถูกต้อง (ไม่ใช่ JSON array)', 502);
    }

    /* ── ตรวจสอบ hash เทียบกับครั้งล่าสุด ── */
    $newHash = md5($raw);
    $log     = getLastLog($db);

    if (!$force && $log && $log['data_hash'] === $newHash) {
        /* ข้อมูลไม่เปลี่ยน — ไม่ sync */
        jsonOk([
            'synced'   => false,
            'reason'   => 'ข้อมูลไม่มีการเปลี่ยนแปลง',
            'last_synced_at' => $log['synced_at'],
        ]);
    }

    /* ── ทำการ sync ── */
    $result = doSync($db, $people);
    saveLog($db, $newHash, $result);

    jsonOk([
        'synced'     => true,
        'added'      => $result['added'],
        'updated'    => $result['updated'],
        'deleted'    => $result['deleted'],
        'skipped'    => $result['skipped'],
        'errors'     => $result['errors'],
        'synced_at'  => gmdate('Y-m-d H:i:s'),
    ]);
}

jsonError('Method not allowed', 405);

/* ═══════════════════════════════════════════════════════════ */

function doSync(PDO $db, array $people): array
{
    $added = $updated = $deleted = $skipped = 0;
    $errors = [];

    /* รายชื่อ username ที่ยัง active จาก RMS */
    $activeFromRms = [];

    foreach ($people as $p) {
        $username = trim((string)($p['people_id']      ?? ''));
        $fname    = trim((string)($p['people_name']    ?? ''));
        $lname    = trim((string)($p['people_surname'] ?? ''));
        $rawPass  = trim((string)($p['ath_pass']       ?? ''));
        $exit     = trim((string)($p['people_exit']    ?? ''));

        if ($username === '') continue;

        /* people_exit ต้องว่าง/null/0 จึงจะ import */
        $isActive = ($exit === '' || $exit === '0' || $exit === null);

        /* ดึงข้อมูลเดิมในระบบ */
        $existing = getExistingUser($db, $username);

        if (!$isActive) {
            /* ออกจากงานแล้ว: ลบออกถ้ามีในระบบ */
            if ($existing) {
                /* ไม่ลบ admin คนสุดท้าย */
                if ($existing['permission'] === 'admin') {
                    $adminCount = (int)$db->query("SELECT COUNT(*) FROM users WHERE permission='admin'")->fetchColumn();
                    if ($adminCount <= 1) { $skipped++; continue; }
                }
                $db->prepare('DELETE FROM users WHERE username = ?')->execute([$username]);
                $deleted++;
            } else {
                $skipped++;
            }
            continue;
        }

        $activeFromRms[] = $username;
        $name = trim("$fname $lname") ?: $username;

        if ($existing) {
            /* อัพเดต — เก็บ role/permission เดิม, อัพเดต name และ password */
            $hash = $rawPass !== '' ? password_hash($rawPass, PASSWORD_BCRYPT, ['cost' => 12]) : null;
            if ($hash) {
                $db->prepare(
                    'UPDATE users SET name=?, password_hash=? WHERE username=?'
                )->execute([$name, $hash, $username]);
            } else {
                $db->prepare('UPDATE users SET name=? WHERE username=?')->execute([$name, $username]);
            }
            $updated++;
        } else {
            /* เพิ่มใหม่ */
            if ($rawPass === '') { $skipped++; continue; }
            $hash = password_hash($rawPass, PASSWORD_BCRYPT, ['cost' => 12]);
            try {
                $db->prepare(
                    'INSERT INTO users (username, password_hash, name, role, permission) VALUES (?,?,?,?,?)'
                )->execute([$username, $hash, $name, '', 'staff']);
                $added++;
            } catch (\Throwable $e) {
                $errors[] = "เพิ่ม $username ไม่ได้: " . $e->getMessage();
            }
        }
    }

    return compact('added', 'updated', 'deleted', 'skipped', 'errors');
}

function getExistingUser(PDO $db, string $username): array|false
{
    $stmt = $db->prepare('SELECT id, username, role, permission FROM users WHERE username = ?');
    $stmt->execute([$username]);
    return $stmt->fetch();
}

function ensureRmsSyncTable(PDO $db): void
{
    $db->exec("
        CREATE TABLE IF NOT EXISTS rms_sync_log (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            synced_at  DATETIME NOT NULL,
            data_hash  VARCHAR(32) NOT NULL,
            added      INT DEFAULT 0,
            updated    INT DEFAULT 0,
            deleted    INT DEFAULT 0,
            skipped    INT DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function getLastLog(PDO $db): array|false
{
    return $db->query('SELECT * FROM rms_sync_log ORDER BY id DESC LIMIT 1')->fetch();
}

function saveLog(PDO $db, string $hash, array $result): void
{
    $db->prepare(
        'INSERT INTO rms_sync_log (synced_at, data_hash, added, updated, deleted, skipped)
         VALUES (UTC_TIMESTAMP(), ?, ?, ?, ?, ?)'
    )->execute([$hash, $result['added'], $result['updated'], $result['deleted'], $result['skipped']]);

    /* เก็บแค่ 100 รายการล่าสุด */
    $db->exec('DELETE FROM rms_sync_log WHERE id NOT IN (SELECT id FROM (SELECT id FROM rms_sync_log ORDER BY id DESC LIMIT 100) t)');
}
