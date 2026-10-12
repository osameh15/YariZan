<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
fwrite(STDERR, "Enter a strong administrator password (input is not hidden):\n");
$password = rtrim(fgets(STDIN) ?: '', "\r\n");
if (strlen($password) < 14 || strlen($password) > 72) {
    fwrite(STDERR, "Use 14–72 bytes.\n"); exit(1);
}
echo password_hash($password, PASSWORD_DEFAULT), PHP_EOL;
