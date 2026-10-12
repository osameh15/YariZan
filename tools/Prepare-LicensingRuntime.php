<?php
declare(strict_types=1);
// Local CLI provisioning. Output is private server files, never a public artifact.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$directory = $argv[1] ?? '';
if ($directory === '') throw new RuntimeException('Private staging directory is required.');
if (!is_dir($directory)) mkdir($directory, 0700, true);
$dbName = getenv('DATABASE_NAME') ?: '';
$dbUser = getenv('DATABASE_USER_NAME') ?: '';
$dbPassword = getenv('DATABASE_PASSWORD') ?: '';
if (!preg_match('/\A[A-Za-z0-9_]+\z/', $dbName) || $dbUser === '' || $dbPassword === '') {
    throw new RuntimeException('Database secrets are missing or invalid.');
}
$settings = ['dsn' => 'mysql:host=localhost;dbname=' . $dbName . ';charset=utf8mb4',
    'db_user' => $dbUser, 'db_password' => $dbPassword, 'secure_cookies' => true, 'auto_install_schema' => true];
$php = "<?php\ndeclare(strict_types=1);\nreturn array_merge(" . var_export($settings, true)
    . ", ['signing_key_path' => __DIR__ . '/private.pem'], require __DIR__ . '/admin.php');\n";
file_put_contents($directory . '/config.php', $php);
chmod($directory . '/config.php', 0600);
if (getenv('CREATE_ADMIN') === 'true') {
    $password = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $admin = ['admin_username' => 'admin', 'admin_password_hash' => password_hash($password, PASSWORD_DEFAULT)];
    file_put_contents($directory . '/admin.php', "<?php\nreturn " . var_export($admin, true) . ";\n");
    file_put_contents($directory . '/admin-credentials.txt', "URL: https://yarizan.osameh.dev/\nUsername: admin\nPassword: " . $password . "\n");
    chmod($directory . '/admin.php', 0600);
    chmod($directory . '/admin-credentials.txt', 0600);
}
if (getenv('CREATE_SIGNING_KEY') === 'true') {
    $pem = getenv('SIGNING_PRIVATE_KEY') ?: '';
    $key = openssl_pkey_get_private($pem);
    $details = $key === false ? false : openssl_pkey_get_details($key);
    if (!$details || ($details['ec']['curve_name'] ?? '') !== 'prime256v1') {
        throw new RuntimeException('The existing P-256 key is required for initial deployment.');
    }
    file_put_contents($directory . '/private.pem', $pem);
    chmod($directory . '/private.pem', 0600);
}
echo "Private runtime files prepared; values are not printed.\n";
