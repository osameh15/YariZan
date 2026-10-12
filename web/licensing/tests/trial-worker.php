<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/Crypto.php';
require dirname(__DIR__) . '/app/Service.php';
$dsn = getenv('YARIZAN_TEST_DSN') ?: '';
if (!preg_match('/dbname=[a-zA-Z0-9_]*_test(?:;|$)/', $dsn)) exit(2);
$db = new PDO($dsn, getenv('YARIZAN_TEST_DB_USER') ?: '', getenv('YARIZAN_TEST_DB_PASSWORD') ?: '',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
try {
    $service = new YariZan\Licensing\Service($db, $argv[1]);
    $service->trial($argv[2], strtoupper(bin2hex(random_bytes(32))));
    echo 'granted';
} catch (YariZan\Licensing\TrialExhausted) {
    echo 'exhausted';
}
