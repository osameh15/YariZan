<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app-loader.php';
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405); header('Allow: GET');
    echo '{"error":"method_not_allowed"}'; exit;
}
$db->query('SELECT trial_used FROM devices LIMIT 1');
$key = openssl_pkey_get_private(file_get_contents($config['signing_key_path']));
$details = $key === false ? false : openssl_pkey_get_details($key);
if (!$details || ($details['ec']['curve_name'] ?? '') !== 'prime256v1') throw new RuntimeException('Invalid signing key.');
$der = base64_decode(preg_replace('/-----[^-]+-----|\s/', '', $details['key']), true);
echo json_encode(['status' => 'ready', 'product' => 'YariZan', 'version' => 1,
    'public_key_sha256' => hash('sha256', $der)], JSON_THROW_ON_ERROR);
