<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

/* ── Admin-only endpoint ─────────────────────────────────── */
requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];
$id     = (int)($_GET['id'] ?? 0);

try {
    $db = getDB();
    match ($method) {
        'GET'    => handleGet($db),
        'POST'   => handlePost($db),
        'PUT'    => handlePut($db, $id),
        'DELETE' => handleDelete($db, $id),
        default  => jsonError('Method not allowed', 405),
    };
} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}

/* ───────────────────── Handlers ───────────────────── */

function handleGet(PDO $db): never
{
    $users = $db->query(
        'SELECT id, username, name, role, permission, created_at
         FROM users ORDER BY id ASC'
    )->fetchAll();
    jsonOk($users);
}

function handlePost(PDO $db): never
{
    $d        = jsonBody();
    $username = trim($d['username'] ?? '');
    $password = (string)($d['password'] ?? '');
    $name     = trim($d['name']     ?? $username);
    $role     = trim($d['role']     ?? '');
    $perm     = validPermission($d['permission'] ?? 'staff');

    if ($username === '') jsonError('กรุณาระบุชื่อผู้ใช้', 422);
    if ($password === '') jsonError('กรุณาระบุรหัสผ่าน',   422);

    // Duplicate check
    $chk = $db->prepare('SELECT id FROM users WHERE username = ?');
    $chk->execute([$username]);
    if ($chk->fetch()) jsonError('ชื่อผู้ใช้นี้มีในระบบแล้ว', 409);

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $db->prepare(
        'INSERT INTO users (username, password_hash, name, role, permission) VALUES (?,?,?,?,?)'
    )->execute([$username, $hash, $name, $role, $perm]);

    jsonOk(fetchUser($db, (int)$db->lastInsertId()), 201);
}

function handlePut(PDO $db, int $id): never
{
    if ($id <= 0) jsonError('Missing user id');
    $d    = jsonBody();
    $name = trim($d['name'] ?? '');
    $role = trim($d['role'] ?? '');
    $perm = validPermission($d['permission'] ?? 'staff');

    if ($name === '') jsonError('กรุณาระบุชื่อแสดง', 422);

    // Prevent self-demotion
    if ($id === (int)($_SESSION['user']['id'] ?? 0) && $perm !== 'admin') {
        jsonError('ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้');
    }

    if (!empty($d['password'])) {
        $hash = password_hash((string)$d['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare(
            'UPDATE users SET name=?, role=?, permission=?, password_hash=? WHERE id=?'
        )->execute([$name, $role, $perm, $hash, $id]);
    } else {
        $db->prepare(
            'UPDATE users SET name=?, role=?, permission=? WHERE id=?'
        )->execute([$name, $role, $perm, $id]);
    }

    jsonOk(fetchUser($db, $id));
}

function handleDelete(PDO $db, int $id): never
{
    if ($id <= 0) jsonError('Missing user id');
    if ($id === (int)($_SESSION['user']['id'] ?? 0)) {
        jsonError('ไม่สามารถลบบัญชีของตัวเองได้');
    }

    $stmt = $db->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('User not found', 404);

    jsonOk(['deleted' => $id]);
}

/* ───────────────────── Helpers ───────────────────── */

function fetchUser(PDO $db, int $id): array
{
    $stmt = $db->prepare(
        'SELECT id, username, name, role, permission, created_at FROM users WHERE id = ?'
    );
    $stmt->execute([$id]);
    $u = $stmt->fetch();
    if (!$u) jsonError('User not found', 404);
    return $u;
}

function validPermission(string $p): string
{
    return in_array($p, ['admin', 'organizer', 'staff'], true) ? $p : 'staff';
}
