<?php
require __DIR__.'/../../vendor/autoload.php';
$app=require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!$app->environment('testing') || config('database.default')!=='mysql' || config('database.connections.mysql.database')!=='space_crm_test'
    || config('database.connections.mysql.host')!=='127.0.0.1' || !empty(config('database.connections.mysql.url'))
    || Illuminate\Support\Facades\DB::selectOne('SELECT DATABASE() AS name')->name!=='space_crm_test') exit(2);
config(['authorization.enabled'=>true,'b2b.enabled'=>true,'b2b.onsite_enabled'=>true,'b2b.crm_followup_enabled'=>true]);
$v=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$barrier=stream_socket_client($v['barrier'],$code,$message,10);if (!$barrier) exit(3);
fwrite($barrier,"ready\n");if (trim(fgets($barrier))!=='go') exit(4);fclose($barrier);
try {
    $r=app(App\Services\B2BFollowupTasks::class)->create($v['meeting'],$v['input'],App\Models\User::findOrFail($v['user']));
    echo json_encode(['id'=>$r['task']['id'],'created'=>$r['created']]);
} catch (Throwable $e) { fwrite(STDERR,get_class($e).': '.$e->getMessage());exit(5); }
