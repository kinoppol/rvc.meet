<?php
declare(strict_types=1);

/* ─────────────────────────────────────────────────────────────
   RVC-ONE SSO
   GET  ?action=login     → สร้าง state แล้ว redirect ไป RVC-ONE
                            (URL สวย: /web/auth/login ผ่าน .htaccess)
   POST ?action=callback  → รับ token_id / token_key / state
                            (map กับ redirect_uri /web/auth/callback ผ่าน .htaccess)
   GET  ?action=callback&error=access_denied → ผู้ใช้กดไม่อนุญาต
───────────────────────────────────────────────────────────── */

$action = $_GET['action'] ?? 'login';

/* RVC-ONE POST กลับมาแบบ cross-site → browser ไม่ส่ง session cookie (SameSite=Lax)
   ถ้าเปิด session ตอนนี้จะได้ session ใหม่ทับของเดิม → state หาย
   จึงส่งฟอร์มต่อให้ตัวเองอีกครั้งแบบ same-site ก่อน (ยังไม่เปิด session) */
if ($action === 'callback' && $_SERVER['REQUEST_METHOD'] === 'POST' && empty($_POST['_relay'])) {
    relayCallback();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/oa_lib.php';

match ($action) {
    'login'    => handleSsoLogin(),
    'callback' => handleSsoCallback(),
    default    => ssoFail(404, 'ไม่พบหน้าที่ร้องขอ'),
};

/* ───────────────────── Handlers ───────────────────── */

function handleSsoLogin(): never
{
    $state = bin2hex(random_bytes(16));
    $_SESSION['oa_state']    = $state;
    $_SESSION['oa_state_at'] = time();

    header('Cache-Control: no-store');
    header('Location: ' . OA_AUTHORIZE_URL . '?' . http_build_query([
        'client_id'    => OA_CLIENT_ID,
        'redirect_uri' => OA_REDIRECT_URI,
        'state'        => $state,
    ]));
    exit;
}

function handleSsoCallback(): never
{
    /* ผู้ใช้กดไม่อนุญาต / ยกเลิก */
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        unset($_SESSION['oa_state'], $_SESSION['oa_state_at']);
        if (($_GET['error'] ?? '') !== '') redirectApp(['sso' => 'cancel']);
        redirectApp([]);
    }

    $tokenId  = (string)($_POST['token_id']  ?? '');
    $tokenKey = (string)($_POST['token_key'] ?? '');
    $state    = (string)($_POST['state']     ?? '');

    /* ตรวจ state (กัน CSRF)
       - เก็บ state ไว้ (ยังไม่หมดอายุ) และ POST state มา → ต้องตรงกัน
       - POST state ว่าง = IdP-initiated (กดจากหน้า Workspace) → ผ่านได้ ด่านจริงคือ verify token */
    $stored   = (string)($_SESSION['oa_state'] ?? '');
    $storedAt = (int)($_SESSION['oa_state_at'] ?? 0);
    unset($_SESSION['oa_state'], $_SESSION['oa_state_at']);
    if ($stored !== '' && time() - $storedAt > OA_STATE_TTL) $stored = '';

    if ($state !== '' && ($stored === '' || !hash_equals($stored, $state))) {
        ssoFail(400, 'คำขอไม่ถูกต้อง (state ไม่ตรงกัน) — กรุณาเริ่มเข้าสู่ระบบใหม่อีกครั้ง');
    }
    if ($tokenId === '' || $tokenKey === '') {
        ssoFail(400, 'ข้อมูลการเข้าสู่ระบบไม่ครบถ้วน');
    }

    try {
        $oaUser = oaVerifyToken($tokenId, $tokenKey);
    } catch (OaError $e) {
        error_log('[sso] verify failed: ' . $e->reason . ' (HTTP ' . $e->http . ')');
        ssoFail(401, $e->reason === 'invalid'
            ? 'การยืนยันตัวตนไม่สำเร็จ หรือโทเคนหมดอายุแล้ว — กรุณาเข้าสู่ระบบใหม่'
            : 'ไม่สามารถติดต่อระบบ RVC-ONE ได้ในขณะนี้ — กรุณาลองใหม่ภายหลัง');
    }

    try {
        $db = getDB();
        ensurePermissionColumn($db);
        ensureOaUserColumns($db);
        [, $localId] = oaUpsertUser($db, $oaUser);

        $stmt = $db->prepare('SELECT id, username, name, role, permission, active FROM users WHERE id = ?');
        $stmt->execute([$localId]);
        $user = $stmt->fetch();
    } catch (PDOException $e) {
        error_log('[sso] db error: ' . $e->getMessage());
        ssoFail(500, 'เกิดข้อผิดพลาดฐานข้อมูล');
    }

    if (!$user) ssoFail(401, 'ไม่พบบัญชีผู้ใช้');
    if ((int)$user['active'] !== 1) ssoFail(403, 'บัญชีของคุณถูกระงับการใช้งาน — กรุณาติดต่อผู้ดูแลระบบ');

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id'         => (int)$user['id'],
        'username'   => $user['username'],
        'name'       => $user['name'],
        'role'       => $user['role'],
        'permission' => $user['permission'] ?? 'staff',
    ];
    $_SESSION['remember'] = false;
    $_SESSION['sso']      = true;

    redirectApp(['sso' => 'ok']);
}

/* ───────────────────── Helpers ───────────────────── */

/** URL ของหน้าแอป (ทำงานได้ทั้งเมื่อถูกเรียกตรงและผ่าน rewrite /web/auth/...) */
function appUrl(): string
{
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/sso.php', 2)), '/');
    return $dir . '/index.html';
}

function redirectApp(array $qs): never
{
    header('Cache-Control: no-store');
    header('Location: ' . appUrl() . ($qs ? '?' . http_build_query($qs) : ''));
    exit;
}

function ssoFail(int $code, string $message): never
{
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $msg = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    $url = htmlspecialchars(appUrl(), ENT_QUOTES, 'UTF-8');
    echo <<<HTML
<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>เข้าสู่ระบบไม่สำเร็จ — RVCMeet</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:Sarabun,system-ui,sans-serif;background:#f4f6fb;color:#1c2333;padding:16px;box-sizing:border-box}
  .c{background:#fff;border-radius:16px;padding:32px;max-width:440px;box-shadow:0 6px 24px rgba(0,0,0,.08);text-align:center}
  h1{font-size:20px;margin:0 0 10px} p{margin:0 0 22px;line-height:1.6;color:#555}
  a{display:inline-block;padding:10px 20px;border-radius:10px;background:#2f6bff;color:#fff;text-decoration:none;font-weight:600}
</style></head>
<body><div class="c"><h1>เข้าสู่ระบบไม่สำเร็จ</h1><p>{$msg}</p><a href="{$url}">กลับสู่ RVCMeet</a></div></body></html>
HTML;
    exit;
}

/** ส่งฟิลด์ที่ได้รับต่อให้ URL เดิมแบบ same-site เพื่อให้ browser แนบ session cookie มาด้วย */
function relayCallback(): never
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('Referrer-Policy: no-referrer');
    $fields = '';
    foreach (['token_id', 'token_key', 'state'] as $k) {
        $v = htmlspecialchars((string)($_POST[$k] ?? ''), ENT_QUOTES, 'UTF-8');
        $fields .= "<input type=\"hidden\" name=\"$k\" value=\"$v\">";
    }
    echo <<<HTML
<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8"><title>กำลังเข้าสู่ระบบ…</title></head>
<body style="font-family:Sarabun,system-ui,sans-serif;text-align:center;padding-top:20vh;color:#555">
<form id="f" method="post" action="">{$fields}<input type="hidden" name="_relay" value="1">
<noscript><button type="submit">ดำเนินการต่อ</button></noscript></form>
<p>กำลังเข้าสู่ระบบ…</p>
<script>document.getElementById('f').submit();</script>
</body></html>
HTML;
    exit;
}
