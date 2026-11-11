<?php

use App\Http\Controllers\SponsorDeliveryController;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (!$app->environment('testing') || config('database.default') !== 'mysql'
    || config('database.connections.mysql.host') !== '127.0.0.1'
    || config('database.connections.mysql.database') !== 'space_crm_test'
    || !empty(config('database.connections.mysql.url'))
    || DB::selectOne('SELECT DATABASE() AS name')->name !== 'space_crm_test') {
    exit(2);
}

config(['authorization.enabled' => true, 'sponsor_delivery.enabled' => true]);
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$actor = User::findOrFail($input['actor']);
$request = Request::create('/api/sponsor-delivery/'.$input['deal'], 'POST', $input['command']);
$request->setUserResolver(fn () => $actor);
$barrier = stream_socket_client($input['barrier'], $code, $message, 10);
if (!$barrier) exit(3);
stream_set_timeout($barrier, 10);
fwrite($barrier, "ready\n");
if (fgets($barrier) !== "go\n") exit(4);
fclose($barrier);

try {
    app(SponsorDeliveryController::class)->command($request, $input['deal']);
    echo '200';
} catch (HttpExceptionInterface $exception) {
    echo $exception->getStatusCode();
}
