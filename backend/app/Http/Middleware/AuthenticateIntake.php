<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\UniqueConstraintViolationException;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateIntake
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('intake.enabled'),503,'Registration integration is not activated.');
        $key=config('intake.key');
        abort_unless(is_string($key) && strlen($key)>=32 && config('intake.exhibition_id')>0,503);
        $encoded=$request->header('X-Space-Intake','');
        $signature=$request->header('X-Space-Intake-Signature','');
        abort_unless(strlen($encoded)<=2048 && preg_match('/^[A-Za-z0-9_-]+$/',$encoded) && preg_match('/^[a-f0-9]{64}$/',$signature)
            && hash_equals(hash_hmac('sha256',$encoded,$key),$signature),401);
        $c=json_decode(base64_decode(strtr($encoded,'-_','+/'),true)?:'',true);
        abort_unless(is_array($c) && ($c['version']??null)===1 && ($c['purpose']??null)==='SPACE-INTAKE-V1'
            && ($c['issuer']??null)===config('intake.peer') && ($c['audience']??null)===config('intake.role')
            && ($c['site']??null)===config('intake.site') && ($c['exhibition_id']??null)===config('intake.exhibition_id')
            && ($c['key_id']??null)===config('intake.key_id') && ($c['method']??null)===$request->method()
            && ($c['target']??null)===$request->getRequestUri() && is_int($c['issued_at']??null) && is_int($c['expires_at']??null)
            && $c['issued_at']<=time()+5 && $c['expires_at']>time() && $c['expires_at']>$c['issued_at'] && $c['expires_at']-$c['issued_at']<=30
            && is_string($c['nonce']??null) && preg_match('/^[a-f0-9-]{36}$/',$c['nonce'])
            && is_string($c['body_sha256']??null) && hash_equals(hash('sha256',$request->getContent()),$c['body_sha256']),401);
        try {
            DB::table('intake_nonces')->insert(['id'=>hash('sha256',$c['issuer'].':'.$c['key_id'].':'.$c['nonce']),'expires_at'=>date('Y-m-d H:i:s',$c['expires_at'])]);
        } catch (UniqueConstraintViolationException) {
            abort(409,'Service request has already been used.');
        }
        return $next($request);
    }
}
