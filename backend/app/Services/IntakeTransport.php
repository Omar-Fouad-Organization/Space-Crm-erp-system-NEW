<?php
namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/** Purpose-limited transport; keys, sessions and endpoints are separate from CMS. */
class IntakeTransport
{
    public function headers(string $target, string $body): array
    {
        $key = config('intake.key');
        abort_unless(config('intake.enabled') && is_string($key) && strlen($key) >= 32 && config('intake.exhibition_id') > 0, 503, 'Registration integration is not configured.');
        $claims = ['version'=>1,'purpose'=>'SPACE-INTAKE-V1','issuer'=>config('intake.role'),'audience'=>config('intake.peer'),
            'site'=>config('intake.site'),'exhibition_id'=>config('intake.exhibition_id'),'key_id'=>config('intake.key_id'),
            'method'=>'POST','target'=>$target,'issued_at'=>time(),'expires_at'=>time()+30,'nonce'=>Str::uuid()->toString(),'body_sha256'=>hash('sha256',$body)];
        $encoded = rtrim(strtr(base64_encode(json_encode($claims, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        return ['X-Space-Intake'=>$encoded,'X-Space-Intake-Signature'=>hash_hmac('sha256',$encoded,$key)];
    }

    public function send(string $operation, array $payload): array
    {
        abort_unless(in_array($operation,['accept','controls','status','monitor','replay','manifest'],true),422);
        $origin = rtrim((string)config('intake.peer_url'),'/');
        $parts = parse_url($origin);
        $local = app()->environment(['local','testing']) && in_array($parts['host']??'',['127.0.0.1','localhost'],true);
        abort_unless($parts && ($parts['scheme']??'') === ($local ? 'http' : 'https') && empty($parts['user']) && empty($parts['pass']) && empty($parts['query']) && empty($parts['fragment']) && empty($parts['path']),503,'Invalid registration service origin.');
        $target='/api/internal/intake/'.$operation;
        $body=json_encode($payload,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        abort_if(strlen($body)>config('intake.max_bytes'),413);
        $response=Http::connectTimeout(3)->timeout(10)->withoutRedirecting()->withOptions(['verify'=>true,'stream'=>true])
            ->withHeaders($this->headers($target,$body))->acceptJson()->withBody($body,'application/json')->post($origin.$target);
        $stream=$response->toPsrResponse()->getBody();
        $raw=$stream->read(262145);
        abort_if(strlen($raw)>262144 || ! $stream->eof(),502,'Registration service response exceeded its limit.');
        abort_unless($response->successful(),503,'Registration service is temporarily unavailable.');
        $result=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
        abort_unless(is_array($result),502);
        return $result;
    }
}
