<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (!str_contains(getenv('YARIZAN_TEST_DSN') ?: '', 'dbname=yarizan_test;')) {
    throw new RuntimeException('Development setup requires the isolated test database.');
}
mkdir('/tmp/yarizan-dev', 0700, true);
$key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
openssl_pkey_export($key, $pem);
file_put_contents('/tmp/yarizan-dev/private.pem', $pem);
chmod('/tmp/yarizan-dev/private.pem', 0600);
$config = [
    'dsn' => getenv('YARIZAN_TEST_DSN'), 'db_user' => getenv('YARIZAN_TEST_DB_USER'),
    'db_password' => getenv('YARIZAN_TEST_DB_PASSWORD'), 'admin_username' => 'admin',
    'admin_password_hash' => password_hash('Local-test-password-2026', PASSWORD_DEFAULT),
    'signing_key_path' => '/tmp/yarizan-dev/private.pem', 'secure_cookies' => false,
];
file_put_contents('/tmp/yarizan-dev/config.php', '<?php return ' . var_export($config, true) . ';');
chmod('/tmp/yarizan-dev/config.php', 0600);
// Apache runs as www-data; these are exclusively disposable local test credentials.
chown('/tmp/yarizan-dev', 'www-data');
foreach (['private.pem', 'config.php'] as $file) chown('/tmp/yarizan-dev/' . $file, 'www-data');
