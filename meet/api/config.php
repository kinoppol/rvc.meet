<?php
declare(strict_types=1);

/* ── Database defaults (overridden by db.config.php if present) ─── */
define('DB_HOST',    'localhost');
define('DB_PORT',    3306);
define('DB_NAME',    'simplemeet');
define('DB_USER',    'root');
define('DB_PASS',    '');
define('DB_CHARSET', 'utf8mb4');

if (file_exists(__DIR__ . '/db.config.php')) {
    require_once __DIR__ . '/db.config.php';
}

date_default_timezone_set('UTC');

/* ── Session ─────────────────────────────────────────────────────── */
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/* ── Database connection (singleton) ─────────────────────────────── */
function getDB(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
        );
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");
    }
    return $pdo;
}

/* ── Response helpers ────────────────────────────────────────────── */
function jsonOk(mixed $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonError(string $message, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonBody(): array
{
    $raw  = (string) file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        jsonError('Invalid request body', 400);
    }
    return $data;
}

function requireAuth(): void
{
    if (empty($_SESSION['user'])) {
        jsonError('Unauthorized – please log in', 401);
    }
}

/* ── Data helpers ────────────────────────────────────────────────── */

/** Convert any ISO-8601 / datetime string → UTC 'Y-m-d H:i:s' for storage */
function isoToUtc(string $iso): string
{
    if ($iso === '') {
        jsonError('Missing datetime value', 422);
    }
    try {
        $dt = new DateTimeImmutable($iso);
        return $dt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    } catch (\Throwable) {
        jsonError("Invalid datetime: $iso", 422);
    }
}

/** Format a meetings row + attachments array into the shape the frontend expects */
function formatMeeting(array $m, array $attachments): array
{
    $tz    = new DateTimeZone('UTC');
    $start = new DateTimeImmutable($m['start_time'], $tz);
    $end   = new DateTimeImmutable($m['end_time'],   $tz);

    return [
        'id'          => $m['id'],
        'title'       => $m['title'],
        'description' => $m['description'] ?? '',
        'organizer'   => $m['organizer'],
        'dept'        => $m['dept'],
        'invitees'    => $m['invitees'] ?? '',
        'start'       => $start->format(DateTimeInterface::ATOM),
        'end'         => $end->format(DateTimeInterface::ATOM),
        'platform'    => $m['platform'],
        'link'        => $m['link'],
        'location'    => $m['location'] ?? '',
        'attachments' => $attachments,
    ];
}
