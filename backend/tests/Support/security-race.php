<?php

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!$app->environment('testing') || config('database.default') !== 'mysql'
    || config('database.connections.mysql.database') !== 'space_crm_test'
    || config('database.connections.mysql.host') !== '127.0.0.1') {
    fwrite(STDERR, 'Refusing non-local test database.'); exit(2);
}
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$request = Illuminate\Http\Request::create('/api/security/revoke', 'POST', $input['payload'] ?? []);
$store = new Illuminate\Session\Store('race', new Illuminate\Session\ArraySessionHandler(120));
$store->start();
$store->setId($input['session_id']);
$store->put(App\Services\SessionRevocation::STAMP, ['user_id' => $input['user_id'], 'version' => 0]);
$request->setLaravelSession($store);
$request->setUserResolver(fn () => App\Models\User::findOrFail($input['user_id']));
$barrier = stream_socket_client($input['barrier'], $errorCode, $errorText, 10);
if (!$barrier) exit(3);
fwrite($barrier, "ready\n");
if (trim(fgets($barrier)) !== 'go') exit(4);
fclose($barrier);
try {
    $service = app(App\Services\SessionRevocation::class);
    switch ($input['operation']) {
        case 'keep': $service->revoke($input['user_id'], $request); echo 'revoked'; break;
        case 'all': $service->revoke($input['user_id']); echo 'revoked'; break;
        case 'logout': $service->revokeCurrent($request); echo 'logged-out'; break;
        case 'reset': app(App\Http\Controllers\SecurityController::class)->reset($request); echo 'reset'; break;
        default: exit(6);
    }
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    echo match ($e->getStatusCode()) { 401 => 'stale', 422 => 'invalid-token', default => 'unexpected-status' };
} catch (Throwable $e) {
    fwrite(STDERR, 'Security worker failed: '.get_class($e)); exit(5);
}
