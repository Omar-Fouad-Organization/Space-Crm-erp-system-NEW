<?php

// Execute audited application code against the expanded disposable schema only.
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$loader = require __DIR__.'/../../vendor/autoload.php';
$old = $input['backend'];
$map = [];
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($old.'/app', FilesystemIterator::SKIP_DOTS)) as $file) {
    if ($file->isFile() && $file->getExtension() === 'php') {
        $relative = substr($file->getPathname(), strlen($old.'/app/') , -4);
        $map['App\\'.str_replace(['/', '\\'], '\\', $relative)] = $file->getPathname();
    }
}
$loader->addClassMap($map);
foreach (['bootstrap/cache', 'storage/framework/cache/data', 'storage/framework/sessions', 'storage/framework/views', 'storage/logs'] as $directory) {
    if (!is_dir($old.'/'.$directory)) mkdir($old.'/'.$directory, 0755, true);
}
$app = require $old.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!$app->environment('testing') || config('database.default') !== 'mysql'
    || config('database.connections.mysql.database') !== 'space_crm_test'
    || config('database.connections.mysql.host') !== '127.0.0.1') {
    fwrite(STDERR, 'Refusing non-local test database.'); exit(2);
}
try {
    foreach ([App\Models\User::class, App\Services\CrmService::class, App\Http\Controllers\SessionController::class] as $class) {
        if (!str_starts_with(realpath((new ReflectionClass($class))->getFileName()), realpath($old).DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Historical code was not loaded.');
        }
    }
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    $request = Illuminate\Http\Request::create('/api/login', 'POST', [
        'email' => $input['email'], 'password' => $input['password'],
    ], [], [], ['HTTP_ACCEPT' => 'application/json']);
    $response = $kernel->handle($request);
    if ($response->getStatusCode() !== 200) throw new RuntimeException('Historical login failed.');
    $kernel->terminate($request, $response);
    $user = App\Models\User::findOrFail($input['user_id']);
    $client = app(App\Services\CrmService::class)->save('clients', [
        'name' => 'Historical compatibility fixture', 'contact_person' => 'Synthetic',
        'email' => 'historical@example.test', 'type' => 'exhibitor', 'status' => 'prospect',
    ], $user);
    $created = App\Models\User::create(['name' => 'Historical user',
        'email' => 'historical-user@example.test', 'password' => 'HistoricalPassword!2026']);
    echo json_encode(['historical_login' => true, 'client_write' => isset($client['id']),
        'new_user_default_version' => (int) $created->fresh()->auth_version]);
} catch (Throwable $e) {
    fwrite(STDERR, 'Historical compatibility check failed: '.get_class($e)); exit(3);
}
