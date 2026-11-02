<?php

// Child process used only by BoothConcurrencyTest, never by a web route.
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!$app->environment('testing') || config('database.default') !== 'mysql'
    || config('database.connections.mysql.database') !== 'space_crm_test'
    || config('database.connections.mysql.host') !== '127.0.0.1') {
    fwrite(STDERR, 'Refusing non-local test database.'); exit(2);
}
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$barrier = stream_socket_client($input['barrier'], $errorCode, $errorText, 10);
if (!$barrier) exit(3);
fwrite($barrier, "ready\n");
if (trim(fgets($barrier)) !== 'go') exit(4);
fclose($barrier);
try {
    app(App\Services\CrmService::class)->save('deals', $input['deal'], App\Models\User::findOrFail($input['user_id']));
    echo 'reserved';
} catch (Illuminate\Validation\ValidationException $e) {
    echo array_key_exists('booth_id', $e->errors()) ? 'occupied' : 'unexpected-validation';
} catch (Throwable $e) {
    // Do not expose connection strings or fixture data through subprocess errors.
    fwrite(STDERR, 'Reservation worker failed: '.get_class($e)); exit(5);
}
