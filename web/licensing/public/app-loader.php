<?php
declare(strict_types=1);
ini_set('display_errors', '0');
$bootstrap = getenv('YARIZAN_APP_BOOTSTRAP');
if (!$bootstrap) {
    $productionPath = dirname(__DIR__) . '/private/yarizan/app/bootstrap.php';
    $bootstrap = is_file($productionPath) ? $productionPath : dirname(__DIR__) . '/app/bootstrap.php';
}
if (!is_file($bootstrap)) {
    http_response_code(503);
    header('Cache-Control: no-store');
    exit('Licensing service setup is incomplete.');
}
require $bootstrap;
