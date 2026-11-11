<?php
namespace App\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\UniqueConstraintViolationException;

class AuthenticateParticipantGateway
{
    public function handle(Request $request, Closure $next)
    {
        abort_unless(config('participant_portal.enabled') && config('b2b.enabled') && config('authorization.enabled'),503,'Participant access is not activated.');
        abort_if(strlen($request->getContent())>config('participant_portal.max_bytes'),413);
        $encoded=$request->header('X-Space-Portal',''); $signature=$request->header('X-Space-Portal-Signature','');
        abort_unless(strlen($encoded)<=4096 && preg_match('/^[A-Za-z0-9_-]+$/D',$encoded) && preg_match('/^[a-f0-9]{64}$/D',$signature),401);
        $c=json_decode(base64_decode(strtr($encoded,'-_','+/'),true)?:'',true,16);
        abort_unless(is_array($c) && is_string($c['key_id']??null) && in_array($c['key_id'],['primary','previous'],true),401);
        $key=config('participant_portal.keys.'.($c['key_id']??''));
        abort_unless(is_string($key) && strlen($key)>=32 && hash_equals(hash_hmac('sha256',$encoded,$key),$signature),401);
        abort_unless(($c['purpose']??null)==='SPACE-PARTICIPANT-V1' && ($c['version']??null)===1
            && ($c['issuer']??null)===config('participant_portal.issuer') && ($c['audience']??null)===config('participant_portal.audience')
            && ($c['method']??null)===$request->method() && ($c['target']??null)===$request->getRequestUri()
            && is_int($c['issued_at']??null) && is_int($c['expires_at']??null)
            && $c['issued_at']<=time()+5 && $c['expires_at']>time() && $c['expires_at']>$c['issued_at'] && $c['expires_at']-$c['issued_at']<=30
            && is_string($c['nonce']??null) && preg_match('/^[a-f0-9-]{36}$/D',$c['nonce'])
            && is_string($c['body_sha256']??null) && hash_equals(hash('sha256',$request->getContent()),$c['body_sha256']),401);
        try { DB::table('portal_gateway_nonces')->insert(['id'=>hash('sha256',$c['issuer'].':'.$c['key_id'].':'.$c['nonce']),'expires_at'=>date('Y-m-d H:i:s',$c['expires_at'])]); }
        catch (UniqueConstraintViolationException) { abort(409,'Service envelope already used.'); }
        return $next($request);
    }
}
