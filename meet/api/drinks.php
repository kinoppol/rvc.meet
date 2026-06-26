<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

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

function handleGet(PDO $db): never
{
    $rows = $db->query('SELECT id, name, sort_order, is_available FROM drinks ORDER BY sort_order ASC, id ASC')->fetchAll();
    foreach ($rows as &$r) {
        $r['id']           = (int)$r['id'];
        $r['sort_order']   = (int)$r['sort_order'];
        $r['is_available'] = (bool)$r['is_available'];
    }
    jsonOk($rows);
}

function handlePost(PDO $db): never
{
    requireRole(['admin']);
    $d = jsonBody();
    $name = trim($d['name'] ?? '');
    if ($name === '') jsonError('ต้องระบุชื่อเมนูเครื่องดื่ม', 422);
    $db->prepare('INSERT INTO drinks (name, sort_order) VALUES (?, ?)')
       ->execute([$name, (int)($d['sort_order'] ?? 0)]);
    $newId = (int)$db->lastInsertId();
    $row   = $db->prepare('SELECT id, name, sort_order, is_available FROM drinks WHERE id=?');
    $row->execute([$newId]);
    $r = $row->fetch();
    $r['id']           = (int)$r['id'];
    $r['sort_order']   = (int)$r['sort_order'];
    $r['is_available'] = (bool)$r['is_available'];
    jsonOk($r, 201);
}

function handlePut(PDO $db, int $id): never
{
    requireRole(['admin']);
    if ($id === 0) jsonError('Missing drink id');
    $d = jsonBody();
    $name  = trim($d['name'] ?? '');
    if ($name === '') jsonError('ต้องระบุชื่อเมนูเครื่องดื่ม', 422);
    $avail = isset($d['is_available']) ? ($d['is_available'] ? 1 : 0) : 1;
    $sort  = (int)($d['sort_order'] ?? 0);
    $stmt  = $db->prepare('UPDATE drinks SET name=?, is_available=?, sort_order=? WHERE id=?');
    $stmt->execute([$name, $avail, $sort, $id]);
    if ($stmt->rowCount() === 0) {
        $chk = $db->prepare('SELECT id FROM drinks WHERE id=?');
        $chk->execute([$id]);
        if (!$chk->fetch()) jsonError('Drink not found', 404);
    }
    $row = $db->prepare('SELECT id, name, sort_order, is_available FROM drinks WHERE id=?');
    $row->execute([$id]);
    $r = $row->fetch();
    $r['id']           = (int)$r['id'];
    $r['sort_order']   = (int)$r['sort_order'];
    $r['is_available'] = (bool)$r['is_available'];
    jsonOk($r);
}

function handleDelete(PDO $db, int $id): never
{
    requireRole(['admin']);
    if ($id === 0) jsonError('Missing drink id');
    $stmt = $db->prepare('DELETE FROM drinks WHERE id=?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('Drink not found', 404);
    jsonOk(['deleted' => $id]);
}
