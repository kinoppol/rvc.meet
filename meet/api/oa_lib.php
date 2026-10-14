<?php
declare(strict_types=1);
/* ─────────────────────────────────────────────────────────────
   RVC-ONE (OA) helpers
   - verify SSO token (server-to-server)
   - User-sync API client (full / incremental) + upsert ด้วย oa_user_id
   - ห้าม log token_id / token_key / client_secret
───────────────────────────────────────────────────────────── */

require_once __DIR__ . '/oa_config.php';
require_once __DIR__ . '/google_lib.php';   // ensureSettingsTable / getSetting / setSetting

/** รหัสผ่านที่ไม่มีทางตรงกับ password_verify — ใช้กับบัญชีที่สร้างจาก RVC-ONE */
const OA_NO_PASSWORD = '!sso';

class OaError extends RuntimeException
{
    public function __construct(string $message, public readonly string $reason = 'error', public readonly int $http = 0)
    {
        parent::__construct($message);
    }
}

/* ── Schema ──────────────────────────────────────────────────── */

/** เพิ่มคอลัมน์ oa_user_id (คีย์ภายนอกจาก RVC-ONE) และ active ให้ตาราง users */
function ensureOaUserColumns(PDO $db): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    try {
        $db->query('SELECT oa_user_id, active FROM users LIMIT 0');
    } catch (PDOException) {
        $db->exec("ALTER TABLE `users`
            ADD COLUMN IF NOT EXISTS `oa_user_id` INT UNSIGNED NULL DEFAULT NULL AFTER `permission`,
            ADD COLUMN IF NOT EXISTS `active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `oa_user_id`");
        $db->exec("ALTER TABLE `users` ADD UNIQUE INDEX IF NOT EXISTS `uq_oa_user` (`oa_user_id`)");
    }
}

/* ── HTTP ────────────────────────────────────────────────────── */

/**
 * ส่ง request ไป RVC-ONE คืน [httpCode, decodedJson|null]
 * ลองใหม่แบบมีขอบเขตเฉพาะกรณีเครือข่ายล้ม / 5xx / 429
 * @throws OaError เมื่อเชื่อมต่อไม่ได้ครบทุกครั้ง
 */
function oaHttp(string $method, string $url, ?array $form = null, array $curlOpts = [], int $attempts = OA_HTTP_RETRIES): array
{
    if (!function_exists('curl_init')) {
        throw new OaError('PHP cURL extension ไม่ได้เปิดใช้งาน', 'no_curl');
    }

    $lastErr = '';
    for ($i = 1; $i <= max(1, $attempts); $i++) {
        $ch = curl_init($url);
        curl_setopt_array($ch, $curlOpts + [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT        => OA_HTTP_TIMEOUT,
            CURLOPT_USERAGENT      => 'RVCMeet/1.0',
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);
        if ($form !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($form));
        }
        $raw  = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw !== false && $code < 500 && $code !== 429) {
            $json = json_decode((string)$raw, true);
            return [$code, is_array($json) ? $json : null];
        }
        $lastErr = $raw === false ? $err : "HTTP $code";
        if ($i < $attempts) sleep($i);   // 1s, 2s, …
    }
    throw new OaError('เชื่อมต่อ RVC-ONE ไม่ได้ (' . $lastErr . ')', 'unreachable');
}

/* ── SSO ─────────────────────────────────────────────────────── */

/**
 * ตรวจสอบ token กับ verify endpoint — คืน object user เมื่อ valid
 * @throws OaError ('invalid' = โทเคนผิด/หมดอายุ, 'unreachable' = endpoint ล่ม/timeout)
 */
function oaVerifyToken(string $tokenId, string $tokenKey): array
{
    if (!preg_match('/^\d+_\d+$/', $tokenId) || !preg_match('/^[0-9a-f]{64}$/i', $tokenKey)) {
        throw new OaError('โทเคนไม่ถูกต้อง', 'invalid');
    }
    /* ไม่ลองซ้ำเมื่อได้ response แล้ว — ลองซ้ำเฉพาะเครือข่ายล้ม (โทเคนอายุแค่ 5 นาที) */
    [$code, $res] = oaHttp('POST', OA_VERIFY_URL, ['token_id' => $tokenId, 'token_key' => $tokenKey], [
        CURLOPT_TIMEOUT => 10,
    ], 2);

    if ($code === 200 && ($res['valid'] ?? false) === true && is_array($res['user'] ?? null)
        && (int)($res['user']['id'] ?? 0) > 0) {
        return $res['user'];
    }
    if ($code === 200 || $code === 400 || $code === 401) {
        throw new OaError('โทเคนไม่ถูกต้องหรือหมดอายุแล้ว', 'invalid', $code);
    }
    throw new OaError("RVC-ONE ตอบกลับผิดปกติ (HTTP $code)", 'unreachable', $code);
}

/* ── Upsert ──────────────────────────────────────────────────── */

/**
 * เพิ่ม/อัปเดตผู้ใช้จาก RVC-ONE (idempotent) จับคู่ด้วย oa_user_id
 * ถ้ายังไม่เคยจับคู่ และ RVC-ONE ส่ง username ที่ตรงกับบัญชีเดิมที่ยังไม่ผูก → ผูกบัญชีนั้น
 * @return array{0: string, 1: int} [ 'added'|'updated'|'suspended'|'unchanged'|'skipped', local user id ]
 */
function oaUpsertUser(PDO $db, array $u): array
{
    $oaId = (int)($u['id'] ?? 0);
    if ($oaId <= 0) return ['skipped', 0];

    $username = trim((string)($u['username'] ?? ''));
    $name     = trim(trim((string)($u['first_name'] ?? '')) . ' ' . trim((string)($u['last_name'] ?? '')));
    if ($name === '') $name = $username !== '' ? $username : "ผู้ใช้ RVC-ONE #$oaId";
    $dept     = mb_substr(trim((string)($u['department'] ?? '')), 0, 100);
    /* verify_token ไม่ส่ง status → คงค่าเดิมไว้ (ไม่ปลดระงับบัญชีที่ถูกระงับจากการซิงค์) */
    $status   = isset($u['status']) ? (string)$u['status'] : null;

    $stmt = $db->prepare('SELECT id, username, name, role, permission, oa_user_id, active FROM users WHERE oa_user_id = ?');
    $stmt->execute([$oaId]);
    $row = $stmt->fetch();

    if (!$row && $username !== '') {
        $stmt = $db->prepare('SELECT id, username, name, role, permission, oa_user_id, active
                              FROM users WHERE username = ? AND oa_user_id IS NULL');
        $stmt->execute([$username]);
        $row = $stmt->fetch();
    }

    if ($row) {
        $active = $status === null ? (int)$row['active'] : ($status === 'suspended' ? 0 : 1);
        /* ไม่ระงับผู้ดูแลระบบคนสุดท้าย */
        if (!$active && (int)$row['active'] === 1 && $row['permission'] === 'admin') {
            $cnt = (int)$db->query("SELECT COUNT(*) FROM users WHERE permission='admin' AND active=1")->fetchColumn();
            if ($cnt <= 1) $active = 1;
        }
        $role = ($row['role'] === '' && $dept !== '') ? $dept : $row['role'];   // ตำแหน่งที่แอดมินแก้ไว้ไม่ทับ

        $changed = $row['name'] !== $name || $row['role'] !== $role
                || (int)$row['active'] !== $active || (int)($row['oa_user_id'] ?? 0) !== $oaId;
        if (!$changed) return ['unchanged', (int)$row['id']];

        $db->prepare('UPDATE users SET name=?, role=?, active=?, oa_user_id=? WHERE id=?')
           ->execute([$name, $role, $active, $oaId, $row['id']]);
        return [(!$active && (int)$row['active'] === 1) ? 'suspended' : 'updated', (int)$row['id']];
    }

    $active = $status === 'suspended' ? 0 : 1;
    $db->prepare('INSERT INTO users (username, password_hash, name, role, permission, oa_user_id, active)
                  VALUES (?,?,?,?,?,?,?)')
       ->execute([oaUniqueUsername($db, $username, $oaId), OA_NO_PASSWORD, $name, $dept, 'staff', $oaId, $active]);
    return [$active ? 'added' : 'suspended', (int)$db->lastInsertId()];
}

function oaUniqueUsername(PDO $db, string $wanted, int $oaId): string
{
    $base = $wanted !== '' ? mb_substr($wanted, 0, 80) : "oa$oaId";
    $chk  = $db->prepare('SELECT 1 FROM users WHERE username = ?');
    foreach ([$base, "{$base}_{$oaId}"] as $cand) {
        $chk->execute([$cand]);
        if (!$chk->fetchColumn()) return $cand;
    }
    return "oa{$oaId}_" . bin2hex(random_bytes(3));
}

/* ── User-sync ───────────────────────────────────────────────── */

function oaSyncConfigured(): bool
{
    return OA_CLIENT_SECRET !== '';
}

function oaSyncErrorMessage(string $error, int $code, ?array $res): string
{
    return match ($error) {
        'invalid_client'   => 'client_id / client_secret ไม่ถูกต้อง หรือแอปถูกปิดใช้งานใน RVC-ONE',
        'sync_disabled'    => 'ผู้ดูแล RVC-ONE ยังไม่ได้เปิดสิทธิ์ «API ซิงค์ข้อมูลผู้ใช้» ให้แอปนี้',
        'type_not_allowed' => 'แอปนี้ไม่ได้รับอนุญาตให้ดึงผู้ใช้ประเภท "' . OA_SYNC_TYPE . '"',
        default            => 'RVC-ONE error (HTTP ' . $code . ')'
                              . ($error !== '' ? ": $error" : '')
                              . (is_string($res['message'] ?? null) ? ' — ' . $res['message'] : ''),
    };
}

/**
 * ซิงค์ผู้ใช้จาก RVC-ONE
 * - $full = true → ไม่ส่ง since (ดึงทั้งหมด)
 * - since ของรอบถัดไปจะถูกบันทึกเมื่อครบทุกหน้าแล้วเท่านั้น
 * @throws OaError
 */
function oaSync(PDO $db, bool $full = false): array
{
    if (!oaSyncConfigured()) {
        throw new OaError('ยังไม่ได้ตั้งค่า OA_CLIENT_SECRET (env หรือ api/db.config.php)', 'not_configured');
    }
    ensureSettingsTable($db);
    ensureOaUserColumns($db);

    /* กันรันซ้อน (cron + ปุ่มในหน้าเว็บ) */
    if ((int)$db->query("SELECT GET_LOCK('rvcmeet_oa_sync', 0)")->fetchColumn() !== 1) {
        throw new OaError('มีการซิงค์กำลังทำงานอยู่ กรุณารอสักครู่', 'busy');
    }

    $since   = $full ? '' : getSetting($db, 'oa_sync_since');
    $startAt = gmdate('Y-m-d H:i:s');
    $counts  = ['added' => 0, 'updated' => 0, 'suspended' => 0, 'unchanged' => 0, 'skipped' => 0];
    $base    = ['limit' => OA_SYNC_LIMIT];
    if (OA_SYNC_TYPE !== '') $base['type']  = OA_SYNC_TYPE;
    if ($since !== '')       $base['since'] = $since;

    try {
        $cursor     = null;
        $serverTime = null;
        $restarted  = false;
        $pages      = 0;

        while (true) {
            $query = $cursor !== null ? ['cursor' => $cursor, 'limit' => OA_SYNC_LIMIT] : $base;
            [$code, $res] = oaHttp('GET', OA_USERS_URL . '?' . http_build_query($query), null, [
                CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
                CURLOPT_USERPWD  => OA_CLIENT_ID . ':' . OA_CLIENT_SECRET,
            ]);

            if (!is_array($res) || ($res['ok'] ?? false) !== true) {
                $error = (string)($res['error'] ?? '');
                /* bad_cursor → เริ่มรอบใหม่จากหน้าแรก (ครั้งเดียว) */
                if ($error === 'bad_cursor' && !$restarted) {
                    $restarted  = true;
                    $cursor     = null;
                    $serverTime = null;
                    continue;
                }
                throw new OaError(oaSyncErrorMessage($error, $code, $res), $error ?: 'bad_response', $code);
            }

            $serverTime ??= (string)($res['server_time'] ?? '');

            $db->beginTransaction();
            try {
                foreach ((array)($res['users'] ?? []) as $u) {
                    if (!is_array($u)) { $counts['skipped']++; continue; }
                    [$action] = oaUpsertUser($db, $u);
                    $counts[$action]++;
                }
                $db->commit();
            } catch (\Throwable $e) {
                $db->rollBack();
                throw $e;
            }

            $pages++;
            $cursor = $res['next_cursor'] ?? null;
            if (empty($res['has_more']) || !is_string($cursor) || $cursor === '') break;
            if ($pages >= 10000) throw new OaError('จำนวนหน้าผิดปกติ — หยุดการซิงค์', 'too_many_pages');
        }

        /* ครบทุกหน้าแล้ว → ขยับ since */
        if ($serverTime !== '') setSetting($db, 'oa_sync_since', $serverTime);

        $result = $counts + [
            'ok'          => true,
            'full'        => $since === '',
            'since'       => $since ?: null,
            'server_time' => $serverTime ?: null,
            'pages'       => $pages,
            'started_at'  => $startAt,
            'finished_at' => gmdate('Y-m-d H:i:s'),
        ];
        setSetting($db, 'oa_sync_last', json_encode($result, JSON_UNESCAPED_UNICODE));
        error_log(sprintf('[oa_sync] ok full=%d pages=%d added=%d updated=%d suspended=%d unchanged=%d skipped=%d',
            $result['full'], $pages, $counts['added'], $counts['updated'], $counts['suspended'],
            $counts['unchanged'], $counts['skipped']));
        return $result;

    } catch (\Throwable $e) {
        setSetting($db, 'oa_sync_last', json_encode([
            'ok'          => false,
            'error'       => $e->getMessage(),
            'started_at'  => $startAt,
            'finished_at' => gmdate('Y-m-d H:i:s'),
        ] + $counts, JSON_UNESCAPED_UNICODE));
        error_log('[oa_sync] failed: ' . $e->getMessage());
        throw $e instanceof OaError ? $e : new OaError('ซิงค์ไม่สำเร็จ: ' . $e->getMessage(), 'error');
    } finally {
        $db->query("SELECT RELEASE_LOCK('rvcmeet_oa_sync')");
    }
}

function oaSyncStatus(PDO $db): array
{
    ensureSettingsTable($db);
    $last = json_decode(getSetting($db, 'oa_sync_last'), true);
    return [
        'configured' => oaSyncConfigured(),
        'type'       => OA_SYNC_TYPE ?: null,
        'since'      => getSetting($db, 'oa_sync_since') ?: null,
        'last'       => is_array($last) ? $last : null,
    ];
}
