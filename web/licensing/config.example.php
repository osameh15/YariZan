<?php
declare(strict_types=1);

// Copy to private/config.php outside the subdomain's public document root.
return [
    'dsn' => 'mysql:host=localhost;dbname=YOUR_DATABASE;charset=utf8mb4',
    'db_user' => 'YOUR_DATABASE_USER',
    'db_password' => 'CHANGE_ME',
    'admin_username' => 'admin',
    'admin_password_hash' => 'GENERATE_WITH_BIN_PASSWORD_HASH',
    // Use the EXISTING secrets/private.pem to preserve all old serials.
    'signing_key_path' => '/absolute/private/path/private.pem',
    'secure_cookies' => true,
];
