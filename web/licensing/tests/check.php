<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/Crypto.php';
require dirname(__DIR__) . '/app/Service.php';
use YariZan\Licensing\Crypto;
use YariZan\Licensing\Service;

function check(bool $ok, string $label): void {
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    echo 'PASS: ', $label, PHP_EOL;
}
function fails(callable $action): bool {
    try { $action(); return false; } catch (Throwable) { return true; }
}
$key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
openssl_pkey_export($key, $private);
$public = openssl_pkey_get_details($key)['key'];
$keyPath = tempnam(sys_get_temp_dir(), 'yz-key-');
file_put_contents($keyPath, $private); chmod($keyPath, 0600);
$hwid = strtoupper(bin2hex(random_bytes(32)));
$nonce = strtoupper(bin2hex(random_bytes(32)));
try {
    check(Crypto::hwid(strtolower(implode('-', str_split($hwid, 8)))) === $hwid, 'Normalize copied HWID');
    check(fails(fn() => Crypto::hwid(str_repeat('Z', 64))), 'Reject non-hex HWID');
    check(fails(fn() => Crypto::hwid('short')), 'Reject incomplete HWID');
    $serial = Crypto::serial($keyPath, $hwid);
    check(strlen(str_replace('-', '', $serial)) === 103, 'Existing serial encoding length');
    $raw = Crypto::sign($keyPath, "YariZan-Trial-v1|$hwid|$nonce|1");
    check(strlen($raw) === 64, 'P-256 raw signature length');
    check(fails(fn() => Crypto::derToRaw('invalid')), 'Reject malformed DER');
    $vectorPath = getenv('YARIZAN_TEST_VECTOR');
    if ($vectorPath) {
        $credentialHash = strtoupper(hash('sha256', str_replace('-', '', $serial)));
        $accessSignature = base64_encode(Crypto::sign($keyPath, "YariZan-Access-v1|$hwid|$nonce|paid|$credentialHash"));
        file_put_contents($vectorPath, json_encode(['publicKey' => $public, 'hwid' => $hwid, 'serial' => $serial,
            'credentialHash' => $credentialHash, 'accessSignature' => $accessSignature,
            'nonce' => $nonce, 'remaining' => 1, 'signature' => base64_encode($raw)], JSON_THROW_ON_ERROR));
    }
    $dsn = getenv('YARIZAN_TEST_DSN');
    if ($dsn) {
        if (!preg_match('/dbname=[a-zA-Z0-9_]*_test(?:;|$)/', $dsn)) throw new RuntimeException('Use a dedicated database ending in _test.');
        $db = new PDO($dsn, getenv('YARIZAN_TEST_DB_USER') ?: '', getenv('YARIZAN_TEST_DB_PASSWORD') ?: '',
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
        foreach (explode(';', file_get_contents(dirname(__DIR__) . '/database/schema.sql')) as $sql) {
            if (trim($sql) !== '') $db->exec($sql);
        }
        $service = new Service($db, $keyPath);
        try {
            check($service->status($hwid, 'First PC')['remaining'] === 2, 'Registration has two entries without consumption');
            $row = $db->query("SELECT * FROM devices WHERE hwid = '$hwid'")->fetch(PDO::FETCH_ASSOC);
            check($row['customer_name'] === 'First PC' && $row['serial'] === null, 'First status registers PC without a paid serial');
            $service->update($hwid, 'Renamed user', 'Contact description', 'test-admin');
            $service->status($hwid, 'Changed PC');
            $row = $db->query("SELECT * FROM devices WHERE hwid = '$hwid'")->fetch(PDO::FETCH_ASSOC);
            check($row['customer_name'] === 'Renamed user' && $row['notes'] === 'Contact description' && $row['serial'] === null && (int)$row['trial_used'] === 0, 'Registration preserves admin edits; metadata save grants no access');
            $one = $service->trial($hwid, $nonce);
            check($one['remaining'] === 1, 'First trial');
            check($service->authorize($hwid, 'trial', $nonce, $nonce)['mode'] === 'trial', 'Existing trial session reauthorizes without spending entry');
            check($service->trial($hwid, $nonce) === $one, 'Retry returns identical grant');
            check($service->status($hwid)['remaining'] === 1, 'Retry does not double-consume');
            $two = $service->trial($hwid, strtoupper(bin2hex(random_bytes(32))));
            check($two['remaining'] === 0, 'Second trial');
            check(fails(fn() => $service->trial($hwid, strtoupper(bin2hex(random_bytes(32))))), 'Third trial rejected');
            $saved = $service->issue($hwid, 'کاربر آزمایشی', 'Test notes', 'test-admin');
            check($service->issue($hwid, 'Updated', '', 'test-admin') === $saved, 'Repeated issue preserves stored serial');
            $service->update($hwid, 'Edited paid user', 'Searchable description', 'test-admin');
            check($db->query("SELECT serial FROM devices WHERE hwid = '$hwid'")->fetchColumn() === $saved, 'Editing paid user preserves exact serial');
            $service->resetTrial($hwid, 'test-admin');
            check($service->status($hwid)['remaining'] === 2, 'Panel reset restores two entries');
            check($service->trial($hwid, $nonce)['remaining'] === 1, 'Reset invalidates old retry grant');
            check($service->issue($hwid, '', '', 'test-admin') === $saved, 'Trial reset preserves paid serial');
            $broken = new Service($db, $keyPath . '.missing');
            check(fails(fn() => $broken->trial($hwid, strtoupper(bin2hex(random_bytes(32))))), 'Signing failure rejects access');
            check($service->status($hwid)['remaining'] === 1, 'Signing failure rolls back consumption');
            $service->resetTrial($hwid, 'test-admin');
            $workers = [];
            for ($i = 0; $i < 4; $i++) {
                $process = proc_open([PHP_BINARY, __DIR__ . '/trial-worker.php', $keyPath, $hwid],
                    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
                if (!is_resource($process)) throw new RuntimeException('Cannot start concurrency test.');
                fclose($pipes[0]);
                $workers[] = [$process, $pipes[1], $pipes[2]];
            }
            $successes = 0;
            foreach ($workers as [$process, $output, $errors]) {
                $result = stream_get_contents($output); $error = stream_get_contents($errors);
                fclose($output); fclose($errors);
                if (proc_close($process) !== 0) throw new RuntimeException('Concurrency worker failed: ' . $error);
                if ($result === 'granted') $successes++;
            }
            check($successes === 2 && $service->status($hwid)['remaining'] === 0, 'Concurrent processes receive exactly two grants');
            check($service->authorize($hwid, 'paid', $saved, $nonce)['mode'] === 'paid', 'Stored paid serial authorizes online');
            $replacement = $service->regenerate($hwid, 'test-admin');
            check($replacement !== $saved, 'Regeneration produces a different serial');
            check(fails(fn() => $service->authorize($hwid, 'paid', $saved, $nonce)), 'Regenerated old serial is denied');
            check($service->authorize($hwid, 'paid', $replacement, $nonce)['mode'] === 'paid', 'New serial authorizes');
            $service->deleteDevice($hwid);
            foreach (['devices', 'trial_grants', 'audit_events'] as $table) {
                $stmt = $db->prepare("SELECT COUNT(*) FROM $table WHERE hwid = ?"); $stmt->execute([$hwid]);
                check((int)$stmt->fetchColumn() === 0, 'Device deletion clears ' . $table);
            }
            $service->deleteDevice($hwid);
            check(fails(fn() => $service->status($hwid)), 'Deleted HWID cannot register for fresh trial');
            check(fails(fn() => $service->trial($hwid, $nonce)), 'Deleted HWID cannot consume trial');
            check(fails(fn() => $service->authorize($hwid, 'paid', $replacement, $nonce)), 'Deleted HWID cannot authorize saved activation');
            $restored = $service->issue($hwid, 'Restored', '', 'test-admin');
            check($restored !== $replacement && $service->authorize($hwid, 'paid', $restored, $nonce)['mode'] === 'paid', 'Admin restores device with new serial');
        } finally {
            foreach (['trial_grants', 'audit_events', 'devices', 'blocked_devices'] as $table) {
                $stmt = $db->prepare("DELETE FROM $table WHERE hwid = ?"); $stmt->execute([$hwid]);
            }
        }
    } else {
        echo "NOTE: Database checks require YARIZAN_TEST_DSN pointing to a disposable *_test database.\n";
    }
} finally { unlink($keyPath); }
