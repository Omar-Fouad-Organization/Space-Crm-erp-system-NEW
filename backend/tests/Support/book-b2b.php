<?php

require __DIR__.'/../../vendor/autoload.php';
$app=require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!$app->environment('testing') || config('database.default')!=='mysql' || config('database.connections.mysql.database')!=='space_crm_test'
    || config('database.connections.mysql.host')!=='127.0.0.1' || !empty(config('database.connections.mysql.url'))
    || Illuminate\Support\Facades\DB::selectOne('SELECT DATABASE() AS name')->name!=='space_crm_test') { exit(2); }
config(['authorization.enabled'=>true,'intake.enabled'=>true,'b2b.enabled'=>true]);
$input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$barrier=stream_socket_client($input['barrier'],$code,$message,10); if (!$barrier) { exit(3); }
fwrite($barrier,"ready\n"); if (trim(fgets($barrier))!=='go') { exit(4); } fclose($barrier);
try {
    app(App\Services\B2BScheduler::class)->schedule($input['booking'],App\Models\User::findOrFail($input['user_id'])); echo 'booked';
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    if ($e->getStatusCode()!==409) { fwrite(STDERR,'Unexpected booking rejection '.$e->getStatusCode()); exit(5); } echo 'occupied';
} catch (Throwable $e) { fwrite(STDERR,'Booking worker failed: '.get_class($e)); exit(6); }
