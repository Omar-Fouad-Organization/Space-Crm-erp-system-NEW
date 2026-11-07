<?php
require __DIR__.'/../../vendor/autoload.php';$app=require __DIR__.'/../../bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(!app()->environment('testing')||config('database.connections.mysql.host')!=='127.0.0.1'||Illuminate\Support\Facades\DB::selectOne('SELECT DATABASE() AS name')->name!=='space_crm_test')throw new RuntimeException('Disposable test database required.');
config(['authorization.enabled'=>true,'b2b.enabled'=>true,'participant_portal.enabled'=>true,'participant_onboarding.test_invites'=>true]);$input=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);
if($input['kind']==='activate-verified'){config(['participant_onboarding.enabled'=>true,'participant_onboarding.sandbox'=>true,'participant_onboarding.mailer'=>'array','participant_onboarding.website_origin'=>'http://127.0.0.1:18891','participant_onboarding.keys.primary'=>'base64:'.base64_encode(str_repeat('k',32)),'participant_portal.keys.primary'=>str_repeat('p',40)]);}
$barrier=stream_socket_client($input['barrier']);fwrite($barrier,"ready\n");stream_set_timeout($barrier,15);if(fgets($barrier)!=="go\n")throw new RuntimeException('Barrier failed.');
try{
 if(in_array($input['kind'],['activate','activate-verified'],true)){$r=Illuminate\Http\Request::create('/','POST',[],[],[],['CONTENT_TYPE'=>'application/json'],json_encode($input['payload'],JSON_THROW_ON_ERROR));app(App\Http\Controllers\ParticipantGatewayController::class)->activate($r);}
 else app(App\Services\ParticipantAuthority::class)->execute($input['payload']);
 echo 'confirmed';
}catch(Symfony\Component\HttpKernel\Exception\HttpException $e){if($e->getStatusCode()===409)echo 'conflict';else throw $e;}
