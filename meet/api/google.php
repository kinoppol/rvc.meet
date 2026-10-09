<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/google_lib.php';

/* ─────────────────────────────────────────────────────────────
   Google Calendar API
   GET  ?action=status       → สถานะการเชื่อมต่อ (admin/organizer)
   POST ?action=config       → บันทึก client id/secret/calendar id (admin)
   GET  ?action=connect      → redirect ไปหน้ายินยอมของ Google (admin)
   GET  ?action=callback     → Google redirect กลับมาพร้อม code
   POST ?action=disconnect   → เพิกถอน token (admin)
   POST ?action=create_meet  → สร้าง event + ลิงก์ Google Meet (admin/organizer)
───────────────────────────────────────────────────────────── */

$action = $_GET['action'] ?? 'status';
$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();
    ensureSettingsTable($db);

    /* connect / callback เป็น browser redirect ไม่ใช่ JSON */
    if ($action === 'connect')  handleConnect($db);
    if ($action === 'callback') handleCallback($db);

    header('Content-Type: application/json; charset=utf-8');
    match (true) {
        $action === 'status'      && $method === 'GET'  => handleStatus($db),
        $action === 'config'      && $method === 'POST' => handleConfig($db),
        $action === 'disconnect'  && $method === 'POST' => handleDisconnect($db),
        $action === 'create_meet' && $method === 'POST' => handleCreateMeet($db),
        default => jsonError('Unknown action', 404),
    };
} catch (PDOException $e) {
    header('Content-Type: application/json; charset=utf-8');
    jsonError('Database error: ' . $e->getMessage(), 500);
} catch (RuntimeException $e) {
    header('Content-Type: application/json; charset=utf-8');
    jsonError($e->getMessage(), 502);
}

/* ───────────────────── Handlers ───────────────────── */

function handleStatus(PDO $db): never
{
    requireRole(['admin', 'organizer']);
    $isAdmin = ($_SESSION['user']['permission'] ?? '') === 'admin';

    $data = [
        'configured' => googleConfigured($db),
        'connected'  => googleConnected($db),
        'email'      => getSetting($db, 'google_account_email'),
    ];
    if ($isAdmin) {
        $data += [
            'client_id'       => getSetting($db, 'google_client_id'),
            'has_secret'      => getSetting($db, 'google_client_secret') !== '',
            'calendar_id'     => googleCalendarId($db),
            'redirect_uri'    => googleRedirectUri(),
            'curl_available'  => function_exists('curl_init'),
        ];
    }
    jsonOk($data);
}

function handleConfig(PDO $db): never
{
    requireRole(['admin']);
    $d = jsonBody();

    $clientId = trim((string)($d['client_id'] ?? ''));
    $secret   = trim((string)($d['client_secret'] ?? ''));
    $calId    = trim((string)($d['calendar_id'] ?? '')) ?: 'primary';

    if ($clientId === '') jsonError('กรุณาระบุ Client ID', 422);
    if ($secret === '' && getSetting($db, 'google_client_secret') === '') {
        jsonError('กรุณาระบุ Client Secret', 422);
    }

    /* เปลี่ยน client → token เดิมใช้ไม่ได้แล้ว */
    if ($clientId !== getSetting($db, 'google_client_id') && getSetting($db, 'google_client_id') !== '') {
        googleRevoke($db);
    }

    setSetting($db, 'google_client_id', $clientId);
    if ($secret !== '') setSetting($db, 'google_client_secret', $secret);   // ว่าง = คงค่าเดิม
    setSetting($db, 'google_calendar_id', $calId);

    handleStatus($db);
}

function handleConnect(PDO $db): never
{
    if (($_SESSION['user']['permission'] ?? '') !== 'admin') {
        redirectBack('error', 'เฉพาะผู้ดูแลระบบเท่านั้น');
    }
    if (!googleConfigured($db)) {
        redirectBack('error', 'กรุณาบันทึก Client ID และ Client Secret ก่อน');
    }
    $state = bin2hex(random_bytes(16));
    $_SESSION['google_oauth_state'] = $state;
    header('Location: ' . googleAuthUrl($db, $state));
    exit;
}

function handleCallback(PDO $db): never
{
    $expected = $_SESSION['google_oauth_state'] ?? '';
    unset($_SESSION['google_oauth_state']);

    if (($_SESSION['user']['permission'] ?? '') !== 'admin') {
        redirectBack('error', 'เฉพาะผู้ดูแลระบบเท่านั้น');
    }
    if ($expected === '' || !hash_equals($expected, (string)($_GET['state'] ?? ''))) {
        redirectBack('error', 'คำขอไม่ถูกต้อง (state mismatch) — กรุณาลองใหม่');
    }
    if (!empty($_GET['error'])) {
        redirectBack('error', 'Google ปฏิเสธการเชื่อมต่อ: ' . $_GET['error']);
    }
    try {
        googleExchangeCode($db, (string)($_GET['code'] ?? ''));
    } catch (RuntimeException $e) {
        redirectBack('error', $e->getMessage());
    }
    redirectBack('connected');
}

function handleDisconnect(PDO $db): never
{
    requireRole(['admin']);
    googleRevoke($db);
    handleStatus($db);
}

function handleCreateMeet(PDO $db): never
{
    requireRole(['admin', 'organizer']);
    if (!googleConnected($db)) {
        jsonError('ยังไม่ได้เชื่อมต่อ Google Calendar — กรุณาให้ผู้ดูแลระบบตั้งค่าที่เมนู "Google Calendar"', 409);
    }
    $d = jsonBody();
    foreach (['start', 'end'] as $k) {
        if (empty($d[$k])) jsonError('กรุณาระบุเวลาเริ่มและเวลาสิ้นสุด', 422);
        try { new DateTimeImmutable((string)$d[$k]); }
        catch (\Throwable) { jsonError("Invalid datetime: {$d[$k]}", 422); }
    }
    if (strtotime((string)$d['end']) <= strtotime((string)$d['start'])) {
        jsonError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม', 422);
    }

    jsonOk(googleCreateMeetEvent($db, $d), 201);
}

/** กลับไปหน้าแอปพร้อมผลลัพธ์ใน query string */
function redirectBack(string $result, string $message = ''): never
{
    $qs = ['google' => $result];
    if ($message !== '') $qs['msg'] = $message;
    header('Location: ../index.html?' . http_build_query($qs));
    exit;
}
