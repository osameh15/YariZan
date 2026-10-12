<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/app/bootstrap.php';
$stmt = $db->prepare('DELETE FROM rate_limits WHERE expires_at < ?');
$stmt->execute([time() - 3600]);
$db->exec('DELETE FROM audit_events WHERE created_at < UTC_TIMESTAMP() - INTERVAL 365 DAY');
// Keep trial_grants for idempotent retries. At most two records per device between resets.
echo "Maintenance complete.\n";
