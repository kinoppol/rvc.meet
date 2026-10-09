<?php
declare(strict_types=1);
/* ─────────────────────────────────────────────────────────────
   Google Calendar integration helpers
   - เก็บ client id/secret + refresh token ในตาราง app_settings
   - ใช้ OAuth 2.0 (แอดมินเชื่อมบัญชี Google ครั้งเดียว)
   - สร้าง/แก้ไข/ลบ event พร้อมลิงก์ Google Meet ผ่าน Calendar API v3
───────────────────────────────────────────────────────────── */

const GOOGLE_SCOPES   = 'openid email https://www.googleapis.com/auth/calendar.events';
const GOOGLE_TIMEZONE = 'Asia/Bangkok';

/* ── Settings store (key/value) ──────────────────────────────── */

function ensureSettingsTable(PDO $db): void
{
    $db->exec("CREATE TABLE IF NOT EXISTS `app_settings` (
        `k`          VARCHAR(64) NOT NULL,
        `v`          TEXT,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`k`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function getSetting(PDO $db, string $key, string $default = ''): string
{
    $stmt = $db->prepare('SELECT v FROM app_settings WHERE k=?');
    $stmt->execute([$key]);
    $v = $stmt->fetchColumn();
    return $v === false || $v === null ? $default : (string)$v;
}

function setSetting(PDO $db, string $key, ?string $value): void
{
    if ($value === null) {
        $db->prepare('DELETE FROM app_settings WHERE k=?')->execute([$key]);
        return;
    }
    $db->prepare('INSERT INTO app_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v=VALUES(v)')
       ->execute([$key, $value]);
}

/* ── Status ──────────────────────────────────────────────────── */

function googleConfigured(PDO $db): bool
{
    return getSetting($db, 'google_client_id') !== '' && getSetting($db, 'google_client_secret') !== '';
}

function googleConnected(PDO $db): bool
{
    return googleConfigured($db) && getSetting($db, 'google_refresh_token') !== '';
}

function googleCalendarId(PDO $db): string
{
    return getSetting($db, 'google_calendar_id', 'primary') ?: 'primary';
}

/** Redirect URI ที่ต้องลงทะเบียนใน Google Cloud Console */
function googleRedirectUri(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
          || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host  = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost';
    $dir   = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/google.php')), '/');
    return ($https ? 'https' : 'http') . '://' . $host . $dir . '/google.php?action=callback';
}

/* ── HTTP ────────────────────────────────────────────────────── */

/**
 * ส่ง HTTP request แล้วคืน [httpCode, decodedJson|null]
 * $body: array → form-encoded, string → ส่งตามที่ให้มา (JSON)
 */
function googleHttp(string $method, string $url, array|string|null $body = null, array $headers = []): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP cURL extension ไม่ได้เปิดใช้งาน');
    }
    $ch = curl_init($url);
    $opts = [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => $headers,
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = is_array($body) ? http_build_query($body) : $body;
    }
    curl_setopt_array($ch, $opts);
    $raw  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('เชื่อมต่อ Google ไม่ได้: ' . $err);
    }
    return [$code, $raw === '' ? null : json_decode((string)$raw, true)];
}

function googleErrorMessage(?array $res, int $code): string
{
    $msg = $res['error']['message'] ?? $res['error_description'] ?? $res['error'] ?? null;
    return 'Google API error (HTTP ' . $code . ')' . (is_string($msg) ? ': ' . $msg : '');
}

/* ── OAuth ───────────────────────────────────────────────────── */

function googleAuthUrl(PDO $db, string $state): string
{
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id'     => getSetting($db, 'google_client_id'),
        'redirect_uri'  => googleRedirectUri(),
        'response_type' => 'code',
        'scope'         => GOOGLE_SCOPES,
        'access_type'   => 'offline',
        'prompt'        => 'consent',   // บังคับให้ได้ refresh_token ทุกครั้ง
        'state'         => $state,
    ]);
}

/** แลก authorization code → เก็บ refresh token + email ของบัญชี */
function googleExchangeCode(PDO $db, string $code): void
{
    [$http, $res] = googleHttp('POST', 'https://oauth2.googleapis.com/token', [
        'code'          => $code,
        'client_id'     => getSetting($db, 'google_client_id'),
        'client_secret' => getSetting($db, 'google_client_secret'),
        'redirect_uri'  => googleRedirectUri(),
        'grant_type'    => 'authorization_code',
    ]);
    if ($http !== 200 || empty($res['access_token'])) {
        throw new RuntimeException(googleErrorMessage($res, $http));
    }
    if (empty($res['refresh_token'])) {
        throw new RuntimeException('Google ไม่ได้ส่ง refresh token กลับมา — กรุณาลองเชื่อมต่อใหม่');
    }

    setSetting($db, 'google_refresh_token', $res['refresh_token']);
    setSetting($db, 'google_access_token',  $res['access_token']);
    setSetting($db, 'google_token_expires', (string)(time() + (int)($res['expires_in'] ?? 3600) - 60));

    [$h2, $info] = googleHttp('GET', 'https://openidconnect.googleapis.com/v1/userinfo', null, [
        'Authorization: Bearer ' . $res['access_token'],
    ]);
    setSetting($db, 'google_account_email', $h2 === 200 ? (string)($info['email'] ?? '') : '');
}

/** คืน access token ที่ยังไม่หมดอายุ (refresh อัตโนมัติ) */
function googleAccessToken(PDO $db): string
{
    $token   = getSetting($db, 'google_access_token');
    $expires = (int)getSetting($db, 'google_token_expires', '0');
    if ($token !== '' && $expires > time()) {
        return $token;
    }

    $refresh = getSetting($db, 'google_refresh_token');
    if ($refresh === '') {
        throw new RuntimeException('ยังไม่ได้เชื่อมต่อบัญชี Google');
    }
    [$http, $res] = googleHttp('POST', 'https://oauth2.googleapis.com/token', [
        'client_id'     => getSetting($db, 'google_client_id'),
        'client_secret' => getSetting($db, 'google_client_secret'),
        'refresh_token' => $refresh,
        'grant_type'    => 'refresh_token',
    ]);
    if ($http !== 200 || empty($res['access_token'])) {
        if (($res['error'] ?? '') === 'invalid_grant') {
            /* refresh token ถูกเพิกถอน/หมดอายุ → ตัดการเชื่อมต่อ ให้แอดมินเชื่อมใหม่ */
            googleClearTokens($db);
            throw new RuntimeException('สิทธิ์เข้าถึง Google หมดอายุหรือถูกเพิกถอน — กรุณาให้ผู้ดูแลระบบเชื่อมต่อบัญชี Google ใหม่');
        }
        throw new RuntimeException(googleErrorMessage($res, $http));
    }
    setSetting($db, 'google_access_token',  $res['access_token']);
    setSetting($db, 'google_token_expires', (string)(time() + (int)($res['expires_in'] ?? 3600) - 60));
    return $res['access_token'];
}

function googleClearTokens(PDO $db): void
{
    foreach (['google_refresh_token', 'google_access_token', 'google_token_expires', 'google_account_email'] as $k) {
        setSetting($db, $k, null);
    }
}

function googleRevoke(PDO $db): void
{
    $token = getSetting($db, 'google_refresh_token');
    if ($token !== '') {
        try {
            googleHttp('POST', 'https://oauth2.googleapis.com/revoke', ['token' => $token]);
        } catch (\Throwable) {}
    }
    googleClearTokens($db);
}

/* ── Calendar API ────────────────────────────────────────────── */

function googleCalendarRequest(PDO $db, string $method, string $path, ?array $json = null, array $query = []): array
{
    $url = 'https://www.googleapis.com/calendar/v3/calendars/'
         . rawurlencode(googleCalendarId($db)) . '/events' . $path
         . ($query ? '?' . http_build_query($query) : '');

    [$http, $res] = googleHttp($method, $url,
        $json === null ? null : json_encode($json, JSON_UNESCAPED_UNICODE),
        ['Authorization: Bearer ' . googleAccessToken($db), 'Content-Type: application/json']
    );
    if ($http >= 400) {
        throw new RuntimeException(googleErrorMessage($res, $http), $http);
    }
    return $res ?? [];
}

/** สร้าง body ของ event จากข้อมูลการประชุม (start/end เป็น ISO 8601) */
function googleEventBody(array $m): array
{
    $tz  = new DateTimeZone(GOOGLE_TIMEZONE);
    $fmt = static fn(string $iso) => (new DateTimeImmutable($iso))->setTimezone($tz)->format(DateTimeInterface::RFC3339);

    $body = [
        'summary'     => trim((string)($m['title'] ?? '')) ?: 'การประชุม',
        'description' => trim((string)($m['description'] ?? '')),
        'start'       => ['dateTime' => $fmt((string)$m['start']), 'timeZone' => GOOGLE_TIMEZONE],
        'end'         => ['dateTime' => $fmt((string)$m['end']),   'timeZone' => GOOGLE_TIMEZONE],
    ];
    if (trim((string)($m['location'] ?? '')) !== '') {
        $body['location'] = trim((string)$m['location']);
    }
    return $body;
}

/** สร้าง event พร้อม Google Meet → คืน ['event_id', 'link', 'html_link'] */
function googleCreateMeetEvent(PDO $db, array $m): array
{
    $body = googleEventBody($m);
    $body['conferenceData'] = [
        'createRequest' => [
            'requestId'             => bin2hex(random_bytes(12)),
            'conferenceSolutionKey' => ['type' => 'hangoutsMeet'],
        ],
    ];
    $ev = googleCalendarRequest($db, 'POST', '', $body, ['conferenceDataVersion' => 1]);

    /* บางครั้ง Meet ยังสร้างไม่เสร็จ (status=pending) → ถามซ้ำสั้น ๆ */
    for ($i = 0; $i < 5 && empty($ev['hangoutLink']); $i++) {
        usleep(700_000);
        $ev = googleCalendarRequest($db, 'GET', '/' . rawurlencode($ev['id']));
    }
    if (empty($ev['hangoutLink'])) {
        throw new RuntimeException('สร้าง event แล้วแต่ Google ไม่ได้ส่งลิงก์ Meet กลับมา — ตรวจสอบว่าบัญชีนี้เปิดใช้ Google Meet');
    }
    return [
        'event_id'  => $ev['id'],
        'link'      => $ev['hangoutLink'],
        'html_link' => $ev['htmlLink'] ?? '',
    ];
}

/** อัปเดตหัวข้อ/เวลา/รายละเอียดของ event ที่มีอยู่ */
function googleUpdateEvent(PDO $db, string $eventId, array $m): void
{
    googleCalendarRequest($db, 'PATCH', '/' . rawurlencode($eventId), googleEventBody($m));
}

function googleDeleteEvent(PDO $db, string $eventId): void
{
    try {
        googleCalendarRequest($db, 'DELETE', '/' . rawurlencode($eventId));
    } catch (RuntimeException $e) {
        /* 404/410 = ถูกลบไปแล้ว ถือว่าสำเร็จ */
        if (!in_array($e->getCode(), [404, 410], true)) throw $e;
    }
}
