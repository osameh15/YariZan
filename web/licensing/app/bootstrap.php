<?php
declare(strict_types=1);

ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
set_exception_handler(function (Throwable $error): void {
    error_log('YariZan licensing: ' . $error->getMessage());
    http_response_code(503);
    if (str_contains($_SERVER['SCRIPT_NAME'] ?? '', '/api/')) {
        header('Content-Type: application/json');
        echo '{"error":"service_unavailable"}';
    } else {
        echo 'The licensing service is unavailable. Please try again later.';
    }
});

require_once __DIR__ . '/Crypto.php';
require_once __DIR__ . '/Service.php';
$configPath = getenv('YARIZAN_CONFIG') ?: (is_file(dirname(__DIR__) . '/config.php')
    ? dirname(__DIR__) . '/config.php' : dirname(__DIR__) . '/private/config.php');
$config = require $configPath;
if (!is_array($config)) throw new RuntimeException('Invalid service configuration.');
$db = new PDO($config['dsn'], $config['db_user'], $config['db_password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);
$db->exec("SET time_zone = '+00:00'");
if ($config['auto_install_schema'] ?? false) {
    $schemaMarker = dirname($configPath) . '/schema-v2-' . substr(hash('sha256', $config['dsn']), 0, 16) . '.ready';
    if (!is_file($schemaMarker)) {
        $schema = file_get_contents(dirname(__DIR__) . '/database/schema.sql');
        foreach (explode(';', $schema) as $statement) {
            if (trim($statement) !== '') $db->exec($statement);
        }
        if (file_put_contents($schemaMarker, "Schema version 2 installed.\n", LOCK_EX) === false) {
            throw new RuntimeException('Cannot persist schema readiness in the private directory.');
        }
        chmod($schemaMarker, 0600);
    }
}
$service = new YariZan\Licensing\Service($db, $config['signing_key_path']);

function rateLimit(PDO $db, string $key, int $limit, int $seconds): bool
{
    $bucket = hash('sha256', $key);
    $now = time();
    $db->beginTransaction();
    try {
        $stmt = $db->prepare('INSERT INTO rate_limits (bucket, hits, expires_at) VALUES (?, 0, ?) ON DUPLICATE KEY UPDATE bucket = bucket');
        $stmt->execute([$bucket, $now + $seconds]);
        $stmt = $db->prepare('SELECT hits, expires_at FROM rate_limits WHERE bucket = ? FOR UPDATE');
        $stmt->execute([$bucket]);
        $row = $stmt->fetch();
        $expired = (int)$row['expires_at'] <= $now;
        $hits = $expired ? 1 : (int)$row['hits'] + 1;
        $stmt = $db->prepare('UPDATE rate_limits SET hits = ?, expires_at = ? WHERE bucket = ?');
        $stmt->execute([$hits, $expired ? $now + $seconds : $row['expires_at'], $bucket]);
        $db->commit();
        return $hits <= $limit;
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function persianDigits(string|int $value): string
{
    return strtr((string)$value, ['0'=>'۰', '1'=>'۱', '2'=>'۲', '3'=>'۳', '4'=>'۴', '5'=>'۵', '6'=>'۶', '7'=>'۷', '8'=>'۸', '9'=>'۹']);
}

function startAdminSession(array $config): void
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('yarizan_admin');
    session_set_cookie_params(['secure' => (bool)$config['secure_cookies'], 'httponly' => true, 'samesite' => 'Strict', 'path' => '/']);
    session_start();
    if (isset($_SESSION['last_active']) && time() - (int)$_SESSION['last_active'] > 1800) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['last_active'] = time();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}

function checkCsrf(): void
{
    $posted = $_POST['csrf'] ?? null;
    if (!is_string($posted) || !hash_equals($_SESSION['csrf'], $posted)) {
        http_response_code(403);
        exit('Your session changed. Reload the page and try again.');
    }
}
