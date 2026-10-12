<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/app/bootstrap.php';
$sql = file_get_contents(dirname(__DIR__) . '/database/schema.sql');
foreach (explode(';', $sql) as $statement) {
    if (trim($statement) !== '') $db->exec($statement);
}
echo "Licensing schema is ready.\n";
