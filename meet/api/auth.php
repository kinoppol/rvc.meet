<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

match ($method) {
    'GET'    => handleCheck(),
    'POST'   => handleLogin(),
    'DELETE' => handleLogout(),
    default  => jsonError('Method not allowed', 405),
};

/* ── GET: return currently logged-in user (or null) ── */
function handleCheck(): never
{
    jsonOk(['user' => $_SESSION['user'] ?? null]);
}

/* ── POST: authenticate and start session ─────────── */
function handleLogin(): never
{
    $d        = jsonBody();
    $username = trim($d['username'] ?? '');
    $password = (string)($d['password'] ?? '');

    if ($username === '' || $password === '') {
        jsonError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 422);
    }

    try {
        $db = getDB();

        /* Auto-migrate: เพิ่ม permission column กรณียังไม่ได้รัน install.php
           หลังอัปเดต ผู้ใช้เดิมทุกคนจะได้รับสิทธิ์ admin (เหมือนก่อนมีระบบ role) */
        ensurePermissionColumn($db);

        $stmt = $db->prepare(
            'SELECT id, username, password_hash, name, role, permission
             FROM users WHERE username = ? LIMIT 1'
        );
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['user'] = [
                'id'         => $user['id'],
                'username'   => $user['username'],
                'name'       => $user['name'],
                'role'       => $user['role'],
                'permission' => $user['permission'] ?? 'admin',
            ];
            jsonOk(['user' => $_SESSION['user']]);
        }

        // Intentionally vague – prevent username enumeration
        jsonError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);

    } catch (PDOException $e) {
        jsonError('เกิดข้อผิดพลาดฐานข้อมูล: ' . $e->getMessage(), 500);
    }
}

/* ── DELETE: destroy session ─────────────────────── */
function handleLogout(): never
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(
            session_name(), '', time() - 42000,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']
        );
    }
    session_destroy();
    jsonOk(['message' => 'Logged out']);
}

/* ── Auto-migration ──────────────────────────────────
   เพิ่ม `permission` column ถ้ายังไม่มี (upgrade path)
   ผู้ใช้เดิมทั้งหมดจะได้ permission = 'admin' เพราะก่อน
   มีระบบ role พวกเขาสามารถจัดการทุกอย่างได้อยู่แล้ว    */
function ensurePermissionColumn(PDO $db): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    try {
        // ทดสอบว่า column มีอยู่แล้วหรือไม่
        $db->query('SELECT permission FROM users LIMIT 0');
    } catch (PDOException) {
        // column ไม่มี → เพิ่มและตั้งค่า default ให้ผู้ใช้เดิม
        $db->exec(
            "ALTER TABLE `users`
             ADD COLUMN `permission` VARCHAR(20) NOT NULL DEFAULT 'admin'
             AFTER `role`"
        );
        // ผู้ใช้ใหม่ที่สร้างหลังนี้จะเป็น 'staff' (DEFAULT ใน install.php)
        // แต่ผู้ใช้เดิมที่ถูก migrate ได้รับ 'admin' ถูกต้องแล้ว
    }
}
