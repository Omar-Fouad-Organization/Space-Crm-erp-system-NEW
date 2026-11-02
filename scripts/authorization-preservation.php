<?php

// Read-only local evidence. No Laravel boot, migrations, records, secrets or filenames printed.
require __DIR__.'/../backend/vendor/autoload.php';
$root = dirname(__DIR__);
Dotenv\Dotenv::createImmutable($root.'/backend')->load();
if (($_ENV['APP_ENV'] ?? '') !== 'local' || ($_ENV['DB_DATABASE'] ?? '') !== 'space_crm'
    || ($_ENV['DB_HOST'] ?? '') !== '127.0.0.1' || !in_array($argv[1] ?? '', ['before', 'after'])) {
    throw new RuntimeException('Refusing non-local preservation check.');
}
try {
    $pdo = new PDO('mysql:host=127.0.0.1;port='.$_ENV['DB_PORT'].';dbname=space_crm', $_ENV['DB_USERNAME'], $_ENV['DB_PASSWORD'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('SET TRANSACTION READ ONLY'); $pdo->beginTransaction(); $result = [];
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        if (!preg_match('/^[a-z_]+$/', $table)) throw new RuntimeException('Unexpected table.');
        $rows = array_map(fn ($r) => json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $pdo->query('SELECT * FROM `'.$table.'`')->fetchAll(PDO::FETCH_ASSOC));
        sort($rows, SORT_STRING);
        $result[$table] = ['count' => count($rows), 'sha256' => hash('sha256', implode("\n", $rows))];
    }
    $pdo->rollBack(); $files = []; $private = $root.'/backend/storage/app/private';
    if (is_dir($private)) foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($private, FilesystemIterator::SKIP_DOTS)) as $file) {
        if ($file->isFile()) $files[] = hash('sha256', substr($file->getPathname(), strlen($private)).'|'.hash_file('sha256', $file->getPathname()));
    }
    sort($files); $result['_files'] = ['count' => count($files), 'sha256' => hash('sha256', implode("\n", $files))];
    $baseline = $root.'/logs/phase-2-before.json';
    if ($argv[1] === 'before') {
        if (file_exists($baseline)) throw new RuntimeException('Baseline already exists; will not overwrite.');
        file_put_contents($baseline, json_encode($result, JSON_PRETTY_PRINT));
        echo json_encode(['tables' => count($result) - 1, 'private_files' => count($files)]);
    } else {
        $before = json_decode(file_get_contents($baseline), true, 512, JSON_THROW_ON_ERROR); $changed = [];
        foreach (array_unique([...array_keys($before), ...array_keys($result)]) as $key) if (($before[$key] ?? null) !== ($result[$key] ?? null)) $changed[] = $key;
        $summary = ['tables' => count($result) - 1, 'private_files' => count($files), 'changed' => $changed];
        file_put_contents($root.'/logs/phase-2-preservation.json', json_encode($summary, JSON_PRETTY_PRINT)); echo json_encode($summary);
        if ($changed) exit(1);
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'Preservation check failed: '.get_class($e)); exit(1);
}
