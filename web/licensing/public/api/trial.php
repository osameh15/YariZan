<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app-loader.php';
header('Content-Type: application/json; charset=utf-8');

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_THROW_ON_ERROR);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(['error' => 'method_not_allowed'], 405);
}
if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
    respond(['error' => 'json_required'], 415);
}
if (!rateLimit($db, 'api|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 120, 60)) {
    header('Retry-After: 60');
    respond(['error' => 'rate_limited'], 429);
}
try {
    $raw = file_get_contents('php://input', false, null, 0, 4097);
    if ($raw === false || strlen($raw) > 4096) respond(['error' => 'request_too_large'], 413);
    $body = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
    if (!is_array($body) || !is_string($body['hwid'] ?? null)) throw new InvalidArgumentException();
    $hwid = YariZan\Licensing\Crypto::hwid($body['hwid']);
    $operation = $body['operation'] ?? '';
    if ($operation === 'status') {
        $pcName = $body['pc_name'] ?? '';
        if (!is_string($pcName)) throw new InvalidArgumentException();
        respond($service->status($hwid, trim($pcName)));
    }
    if ($operation !== 'consume' || !is_string($body['nonce'] ?? null)) throw new InvalidArgumentException();
    respond($service->trial($hwid, $body['nonce']));
} catch (YariZan\Licensing\TrialExhausted) {
    respond(['error' => 'trial_exhausted', 'remaining' => 0], 403);
} catch (InvalidArgumentException | JsonException) {
    respond(['error' => 'invalid_request'], 400);
}
