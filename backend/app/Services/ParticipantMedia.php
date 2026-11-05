<?php
namespace App\Services;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
class ParticipantMedia
{
 public function read(array $payload):array
 {
  $origin=rtrim((string)config('participant_portal.website_url'),'/');$u=parse_url($origin);$local=app()->environment(['local','testing'])&&in_array($u['host']??'',['localhost','127.0.0.1'],true);
  $key=config('participant_portal.media_key');abort_unless(is_string($key)&&strlen($key)>=32&&$u&&($u['scheme']??'')===($local?'http':'https')&&empty($u['user'])&&empty($u['pass'])&&empty($u['path'])&&empty($u['query'])&&empty($u['fragment']),503,'Private media delegation is not configured.');
  $target='/api/internal/participant-portal/media/read';$body=json_encode($payload,JSON_THROW_ON_ERROR);
  $c=['version'=>1,'key_id'=>config('participant_portal.media_key_id'),'purpose'=>'SPACE-PARTICIPANT-MEDIA-V1','issuer'=>'space-participant-api','audience'=>'green-life-portal-files','method'=>'POST','target'=>$target,'issued_at'=>time(),'expires_at'=>time()+30,'nonce'=>(string)Str::uuid(),'body_sha256'=>hash('sha256',$body)];$encoded=rtrim(strtr(base64_encode(json_encode($c,JSON_THROW_ON_ERROR)),'+/','-_'),'=');
  $r=Http::connectTimeout(3)->timeout(10)->withoutRedirecting()->withOptions(['verify'=>true,'stream'=>true])->withHeaders(['X-Space-Portal-Media'=>$encoded,'X-Space-Portal-Media-Signature'=>hash_hmac('sha256',$encoded,$key)])->withBody($body,'application/json')->post($origin.$target);
  abort_unless($r->successful(),503,'Private media could not be retrieved.');$stream=$r->toPsrResponse()->getBody();$raw=$stream->read(8388609);abort_if(strlen($raw)>8388608||!$stream->eof(),502);$mime=$r->header('Content-Type');abort_unless(in_array($mime,['application/pdf','image/png'],true),502);return [$raw,$mime];
 }
}
