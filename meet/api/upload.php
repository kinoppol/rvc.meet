<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

requireRole(['admin', 'organizer']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$file = $_FILES['file'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
    jsonError('ไม่พบไฟล์หรือเกิดข้อผิดพลาดในการอัพโหลด', 400);
}

/* Validate size: 1 MB */
if ($file['size'] > 1 * 1024 * 1024) {
    jsonError('ขนาดไฟล์เกิน 1 MB', 400);
}

/* Validate MIME type */
$allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
$finfo   = new finfo(FILEINFO_MIME_TYPE);
$mime    = $finfo->file($file['tmp_name']);
if (!in_array($mime, $allowed, true)) {
    jsonError('อนุญาตเฉพาะไฟล์ PDF และ DOCX เท่านั้น', 400);
}

/* Safe filename */
$origName = basename($file['name']);
$ext      = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
if (!in_array($ext, ['pdf', 'docx'], true)) jsonError('นามสกุลไฟล์ไม่ถูกต้อง', 400);

$storedName = bin2hex(random_bytes(12)) . '.' . $ext;
$uploadDir  = __DIR__ . '/../uploads/';
$destPath   = $uploadDir . $storedName;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    jsonError('ไม่สามารถบันทึกไฟล์ได้', 500);
}

/* Human-readable size */
$bytes    = $file['size'];
$sizeStr  = $bytes >= 1048576
    ? round($bytes / 1048576, 1) . ' MB'
    : round($bytes / 1024)       . ' KB';

jsonOk([
    'filename'    => $origName,
    'stored_name' => $storedName,
    'filesize'    => $sizeStr,
    'url'         => 'uploads/' . $storedName,
]);
