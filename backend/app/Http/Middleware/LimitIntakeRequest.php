<?php
namespace App\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
class LimitIntakeRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('api/internal/intake/*','api/registrations/*','api/intake/*') && ! $request->isMethod('GET')) {
            $length=$request->header('Content-Length');
            abort_unless(is_string($length) && ctype_digit($length) && ! $request->hasHeader('Transfer-Encoding'),411);
            abort_if((int)$length>65536 || strlen($request->getContent())>65536,413);
        }
        $response=$next($request);
        if ($request->is('api/internal/intake/*','api/registrations/*','api/intake/*')) {
            $response->headers->set('Cache-Control','no-store, private');
            $response->headers->set('Pragma','no-cache');
        }
        return $response;
    }
}
