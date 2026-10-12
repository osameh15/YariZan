<?php
declare(strict_types=1);
$directory = sys_get_temp_dir() . '/yarizan-runtime-check-' . bin2hex(random_bytes(12));
mkdir($directory, 0700);
$key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
openssl_pkey_export($key, $private);
putenv('DATABASE_NAME=isolated_runtime_test');
putenv('DATABASE_USER_NAME=isolated_test');
putenv('DATABASE_PASSWORD=isolated-test-password');
putenv('SIGNING_PRIVATE_KEY=' . $private);
putenv('CREATE_ADMIN=true');
putenv('CREATE_SIGNING_KEY=true');
$prepare = dirname(__DIR__) . '/Prepare-LicensingRuntime.php';
function prepare(string $script, string $directory): void {
    $process = proc_open([PHP_BINARY, $script, $directory],
        [0=>['pipe','r'], 1=>['pipe','w'], 2=>['pipe','w']], $pipes);
    if (!is_resource($process)) throw new RuntimeException('Cannot start runtime preparation.');
    fclose($pipes[0]); stream_get_contents($pipes[1]); $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    if (proc_close($process) !== 0) throw new RuntimeException('Preparation failed: ' . $errors);
}
try {
    prepare($prepare, $directory);
    $config = require $directory . '/config.php';
    preg_match('/Password: ([A-Za-z0-9_-]+)/', file_get_contents($directory . '/admin-credentials.txt'), $match);
    if (!isset($match[1]) || strlen($match[1]) !== 43 ||
        !password_verify($match[1], $config['admin_password_hash']) || $config['admin_username'] !== 'admin') {
        throw new RuntimeException('Generated credentials do not match the admin hash.');
    }
    if (!$config['secure_cookies'] || !$config['auto_install_schema']) throw new RuntimeException('Insecure runtime defaults.');
    $admin = file_get_contents($directory . '/admin.php');
    $credentials = file_get_contents($directory . '/admin-credentials.txt');
    $signingKey = file_get_contents($directory . '/private.pem');
    putenv('CREATE_ADMIN=false'); putenv('CREATE_SIGNING_KEY=false');
    prepare($prepare, $directory);
    if ($admin !== file_get_contents($directory . '/admin.php') ||
        $credentials !== file_get_contents($directory . '/admin-credentials.txt') ||
        $signingKey !== file_get_contents($directory . '/private.pem')) {
        throw new RuntimeException('A routine deployment would change the existing account or signing key.');
    }
    echo "PASS: strong matching admin credentials, safe runtime defaults, and preserved account/signing key.\n";
} finally {
    foreach (['config.php', 'admin.php', 'admin-credentials.txt', 'private.pem'] as $file) {
        if (is_file($directory . '/' . $file)) unlink($directory . '/' . $file);
    }
    rmdir($directory);
}
