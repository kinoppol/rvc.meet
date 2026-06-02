<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rms_config.php';

header('Content-Type: application/json; charset=utf-8');

/* ── Global exception safety ── */
set_exception_handler(function (\Throwable $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
});

requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();
    ensureRmsSyncTable($db);
} catch (\Throwable $e) {
    jsonError('ไม่สามารถเชื่อมต่อฐานข้อมูล: ' . $e->getMessage());
}

/* ── GET: คืนสถานะ sync ล่าสุด ── */
if ($method === 'GET') {
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

/* ── POST: sync ── */
if ($method === 'POST') {
    $body  = json_decode((string)file_get_contents('php://input'), true) ?? [];
    $force = (bool)($body['force'] ?? false);

    /* ── ดึงข้อมูลจาก RMS ── */
    $url = rtrim(RMS_BASE_URL, '/') . '/' . ltrim(RMS_PEOPLE_PATH, '/');
    [$raw, $fetchErr] = fetchUrl($url);

    if ($raw === null) {
        jsonError('ไม่สามารถเชื่อมต่อ RMS: ' . $fetchErr);   // 400 — ไม่ใช้ 5xx เพื่อหลีกเลี่ยง proxy แทนที่ response
    }

    $people = json_decode($raw, true);
    if (!is_array($people)) {
        jsonError('RMS ส่งข้อมูลไม่ถูกต้อง (ไม่ใช่ JSON array) — ได้รับ: ' . mb_substr($raw, 0, 120));
    }

    /* ── ตรวจสอบ hash ── */
    $newHash = md5($raw);
    $log     = getLastLog($db);

    if (!$force && $log && $log['data_hash'] === $newHash) {
        jsonOk([
            'synced'         => false,
            'reason'         => 'ข้อมูลไม่มีการเปลี่ยนแปลง',
            'last_synced_at' => $log['synced_at'],
        ]);
    }

    /* ── ทำการ sync ── */
    try {
        $result = doSync($db, $people);
    } catch (\Throwable $e) {
        jsonError('เกิดข้อผิดพลาดระหว่าง sync: ' . $e->getMessage());
    }

    saveLog($db, $newHash, $result);

    jsonOk([
        'synced'    => true,
        'added'     => $result['added'],
        'updated'   => $result['updated'],
        'deleted'   => $result['deleted'],
        'skipped'   => $result['skipped'],
        'errors'    => $result['errors'],
        'synced_at' => gmdate('Y-m-d H:i:s'),
    ]);
}

jsonError('Method not allowed', 405);

/* ═══════════════════════════════════════════════════════════ */

/**
 * ดึง URL ด้วย 3 วิธีตามลำดับ: cURL → file_get_contents → stream_socket_client
 * @return array{0: string|null, 1: string}  [body|null, errorMsg]
 */
function fetchUrl(string $url): array
{
    $lastErr = 'ไม่มีวิธีเชื่อมต่อที่ใช้งานได้';

    /* 1. cURL */
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_USERAGENT      => 'RVCMeet/1.0',
        ]);
        $body = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body !== false && $code >= 200 && $code < 300) return [$body, ''];
        $lastErr = $err ?: "cURL HTTP $code";
    }

    /* 2. file_get_contents (ถ้า allow_url_fopen เปิด) */
    if (ini_get('allow_url_fopen')) {
        $ctx  = stream_context_create([
            'http' => ['timeout' => 15, 'ignore_errors' => true, 'user_agent' => 'RVCMeet/1.0'],
            'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body !== false) return [$body, ''];
        $lastErr = 'file_get_contents ล้มเหลว';
    }

    /* 3. stream_socket_client — ไม่ต้องใช้ cURL หรือ allow_url_fopen */
    [$socketBody, $socketErr] = fetchViaSocket($url);
    if ($socketBody !== null) return [$socketBody, ''];
    $lastErr = $socketErr;

    return [null, $lastErr];
}

/**
 * HTTP GET ผ่าน stream_socket_client (รองรับ HTTPS, ไม่ต้องการ cURL)
 */
function fetchViaSocket(string $url): array
{
    $parts  = parse_url($url);
    $scheme = $parts['scheme'] ?? 'http';
    $host   = $parts['host']   ?? '';
    $path   = ($parts['path']  ?? '/');
    $query  = isset($parts['query']) ? '?' . $parts['query'] : '';
    $port   = $parts['port']   ?? ($scheme === 'https' ? 443 : 80);
    $target = $scheme === 'https' ? "ssl://$host:$port" : "tcp://$host:$port";

    $ctx  = stream_context_create([
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true],
    ]);
    $sock = @stream_socket_client($target, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$sock) return [null, "socket [$errno] $errstr"];

    stream_set_timeout($sock, 15);

    $req = implode("\r\n", [
        "GET {$path}{$query} HTTP/1.1",
        "Host: $host",
        "User-Agent: RVCMeet/1.0",
        "Accept: application/json",
        "Connection: close",
        "", "",
    ]);
    fwrite($sock, $req);

    $raw = '';
    while (!feof($sock)) $raw .= fread($sock, 8192);
    fclose($sock);

    /* แยก header กับ body */
    $sep = strpos($raw, "\r\n\r\n");
    if ($sep === false) return [null, 'socket: response ไม่สมบูรณ์'];

    $headers   = substr($raw, 0, $sep);
    $body      = substr($raw, $sep + 4);
    $firstLine = strtok($headers, "\r\n");

    /* ตรวจ HTTP status */
    if (!preg_match('#HTTP/\d+\.\d+\s+(\d+)#', $firstLine, $m)) {
        return [null, 'socket: response ไม่ถูกต้อง'];
    }
    $status = (int)$m[1];
    if ($status < 200 || $status >= 300) {
        return [null, "socket HTTP $status"];
    }

    /* chunked transfer encoding */
    if (stripos($headers, 'Transfer-Encoding: chunked') !== false) {
        $body = httpDechunk($body);
    }

    return [$body ?: null, $body ? '' : 'socket: body ว่าง'];
}

function httpDechunk(string $body): string
{
    $out = '';
    while ($body !== '') {
        $pos  = strpos($body, "\r\n");
        if ($pos === false) break;
        $size = hexdec(trim(substr($body, 0, $pos)));
        if ($size === 0) break;
        $out  .= substr($body, $pos + 2, $size);
        $body  = substr($body, $pos + 2 + $size + 2);
    }
    return $out;
}

function doSync(PDO $db, array $people): array
{
    $added = $updated = $deleted = $skipped = 0;
    $errors = [];

    foreach ($people as $p) {
        $username = trim((string)($p['people_id']      ?? ''));
        $fname    = trim((string)($p['people_name']    ?? ''));
        $lname    = trim((string)($p['people_surname'] ?? ''));
        $rawPass  = trim((string)($p['ath_pass']       ?? ''));
        $exit     = trim((string)($p['people_exit']    ?? ''));

        if ($username === '') continue;

        /* people_exit ว่าง/null/0 = ยังอยู่ */
        $isActive = ($exit === '' || $exit === '0');

        $existing = getExistingUser($db, $username);

        if (!$isActive) {
            if ($existing) {
                /* ไม่ลบ admin คนสุดท้าย */
                if ($existing['permission'] === 'admin') {
                    $cnt = (int)$db->query("SELECT COUNT(*) FROM users WHERE permission='admin'")->fetchColumn();
                    if ($cnt <= 1) { $skipped++; continue; }
                }
                $db->prepare('DELETE FROM users WHERE username = ?')->execute([$username]);
                $deleted++;
            } else {
                $skipped++;
            }
            continue;
        }

        $name = trim("$fname $lname") ?: $username;

        if ($existing) {
            /* อัพเดต — เก็บ role/permission เดิม */
            if ($rawPass !== '') {
                $hash = password_hash($rawPass, PASSWORD_BCRYPT, ['cost' => 12]);
                $db->prepare('UPDATE users SET name=?, password_hash=? WHERE username=?')
                   ->execute([$name, $hash, $username]);
            } else {
                $db->prepare('UPDATE users SET name=? WHERE username=?')
                   ->execute([$name, $username]);
            }
            $updated++;
        } else {
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

    $db->exec('DELETE FROM rms_sync_log WHERE id NOT IN
        (SELECT id FROM (SELECT id FROM rms_sync_log ORDER BY id DESC LIMIT 100) t)');
}
