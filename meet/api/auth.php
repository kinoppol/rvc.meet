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
        $db   = getDB();
        $stmt = $db->prepare(
            'SELECT id, username, password_hash, name, role FROM users WHERE username = ? LIMIT 1'
        );
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['user'] = [
                'id'       => $user['id'],
                'username' => $user['username'],
                'name'     => $user['name'],
                'role'     => $user['role'],
            ];
            jsonOk(['user' => $_SESSION['user']]);
        }

        // Intentionally vague error to prevent username enumeration
        jsonError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);

    } catch (PDOException $e) {
        jsonError('Database error', 500);
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
