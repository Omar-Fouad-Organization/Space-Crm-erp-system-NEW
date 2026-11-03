<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Http};
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class CmsGateway
{
    public function __construct(private PermissionPolicy $policy, private RecordAccess $records) {}

    public function site(string $slug, $user): array
    {
        $this->policy->authorize('website.view', $user);
        abort_unless($this->policy->enabled() && config('cms_gateway.enabled'), 409, 'Website management is not activated.');
        $site = config('cms_gateway.sites.'.$slug);
        abort_unless(is_array($site) && preg_match('/^[a-z0-9-]+$/', $slug), 404);
        abort_unless((int) $site['exhibition_id'] > 0, 503, 'Website management needs a reviewed exhibition binding.');
        $this->records->check('exhibitions', (int) $site['exhibition_id'], $user);
        foreach (['gateway_url','public_origin'] as $property) {
            $url = parse_url($site[$property] ?? '');
            $local = app()->environment(['testing','local']) && in_array($url['host'] ?? '', ['127.0.0.1','localhost'], true);
            abort_unless(in_array($url['scheme'] ?? '', $local ? ['http','https'] : ['https'], true)
                && ! isset($url['user']) && ! isset($url['pass']) && ! isset($url['query']) && ! isset($url['fragment'])
                && ! empty($url['host']), 503, 'Website endpoint configuration is invalid.');
            if ($property === 'public_origin') {
                abort_unless(in_array($url['path'] ?? '', ['', '/'], true), 503, 'Configure a public website origin.');
            }
        }
        return [...$site,'slug'=>$slug];
    }

    public function permissions(string $resource, $user): array
    {
        $permissions = ['website.view'];
        $families = $resource === 'overview' ? array_unique(array_column(config('cms_contract.resources'), 'family'))
            : [in_array($resource, ['upload','asset-delete']) ? 'media' : $this->spec($resource)['family']];
        foreach ($families as $family) {
            foreach (['view','create','edit','delete','publish','upload'] as $action) {
                if ($this->policy->allows($family.'.'.$action, $user)) {
                    $permissions[] = $family.'.'.$action;
                }
            }
        }
        if ($resource === 'overview') {
            $permissions = array_values(array_filter($permissions, fn ($p) => str_ends_with($p, '.view')));
        }
        return array_values(array_unique($permissions));
    }

    public function spec(string $resource): array
    {
        $spec = config('cms_contract.resources.'.$resource);
        abort_unless(is_array($spec), 404, 'Unknown website resource.');
        return $spec;
    }

    /** Only configured, fixed endpoint paths are reachable; browser headers/cookies are never forwarded. */
    public function send(array $site, string $resource, array $input, $user, ?string $file = null, ?string $bucket = null): array
    {
        $key = config('cms_gateway.key');
        abort_unless(is_string($key) && strlen($key) >= 32, 503, 'CMS service credentials are not configured.');
        $url = rtrim($site['gateway_url'], '/').'/'.$site['slug'].'/'.$resource;
        if ($file) {
            $url .= '?'.http_build_query(['bucket'=>$bucket], '', '&', PHP_QUERY_RFC3986);
        }
        $body = $file ? null : json_encode($input, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        abort_if($file ? filesize($file) > config('cms_gateway.max_upload_bytes') : strlen($body) > config('cms_gateway.max_json_bytes'), 413, 'CMS request is too large.');
        $uri = parse_url($url);
        $target = ($uri['path'] ?? '/').(isset($uri['query']) ? '?'.$uri['query'] : '');
        $correlation = (string) Str::uuid();
        $attempts = ! $file && ($input['operation'] ?? null) === 'list' ? 2 : 1;
        $status = 502;
        try {
            for ($attempt = 0; $attempt < $attempts; $attempt++) {
                $claims = ['version'=>1,'issuer'=>config('cms_gateway.issuer'),'service'=>config('cms_gateway.service'),
                    'key_id'=>config('cms_gateway.key_id'),'audience'=>$site['audience'],'actor'=>'erp:'.$user->id,
                    'site'=>$site['slug'],'exhibition_id'=>(int) $site['exhibition_id'],'issued_at'=>time(),'expires_at'=>time()+30,
                    'nonce'=>bin2hex(random_bytes(32)),'correlation_id'=>$correlation,'method'=>'POST','target'=>$target,
                    'body_sha256'=>$file ? hash_file('sha256', $file) : hash('sha256', $body),
                    'permissions'=>$this->permissions($resource, $user)];
                $encoded = rtrim(strtr(base64_encode(json_encode($claims, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
                $stream = $file ? fopen($file, 'rb') : null;
                try {
                    $response = Http::acceptJson()->connectTimeout(3)->timeout(10)->withOptions(['allow_redirects'=>false,'stream'=>true])
                        ->withHeaders(['X-Space-Delegation'=>$encoded,'X-Space-Signature'=>hash_hmac('sha256', $encoded, $key)])
                        ->withBody($stream ?: $body, $file ? 'application/octet-stream' : 'application/json')->send('POST', $url);
                    $status = $response->status();
                    $reader = $response->toPsrResponse()->getBody();
                    $raw = '';
                    while (! $reader->eof()) {
                        $raw .= $reader->read(65536);
                        abort_if(strlen($raw) > config('cms_gateway.max_response_bytes'), 502, 'CMS response exceeded its safe size limit.');
                    }
                    $data = json_decode($raw, true);
                    abort_unless(is_array($data), 502, 'CMS returned an invalid response.');
                    if ($status >= 500 && $attempt + 1 < $attempts) {
                        continue;
                    }
                    if (! $response->successful()) {
                        if ($status === 422 && is_array($data['errors'] ?? null)) {
                            $errors=[];
                            foreach (array_slice($data['errors'],0,30,true) as $field=>$messages) {
                                if (is_string($field) && preg_match('/^[A-Za-z0-9_.]{1,100}$/',$field) && is_array($messages)) {
                                    $errors[$field]=array_map(fn($message)=>mb_substr((string)$message,0,300),array_slice(array_filter($messages,'is_string'),0,3));
                                }
                            }
                            if ($errors) throw \Illuminate\Validation\ValidationException::withMessages($errors);
                        }
                        $safe = in_array($status, [403,404,409,413,422], true) ? $status : 502;
                        $message = match ($safe) {
                            403=>'The CMS rejected this delegated action.',404=>'CMS record not found.',
                            409=>'Content changed or this request was already used. Reload before saving.',
                            413=>'CMS response is too large. Use a smaller selection.',422=>'CMS validation failed. Review the editor field values.',
                            default=>'The website CMS is unavailable. Reload before retrying a save; writes are never retried automatically.',
                        };
                        throw new HttpException($safe, $message.' Reference: '.$correlation);
                    }
                    abort_unless(($data['correlation_id'] ?? null) === $correlation && array_key_exists('data', $data), 502, 'CMS response contract mismatch.');
                    return $data;
                } catch (\Illuminate\Http\Client\ConnectionException $error) {
                    if ($attempt + 1 >= $attempts) {
                        abort(502, 'The website CMS is unavailable. Reload before retrying a save. Reference: '.$correlation);
                    }
                } finally {
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                }
            }
            abort(502, 'The website CMS is unavailable.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $error) {
            $status=$error->getStatusCode();throw $error;
        } catch (\Illuminate\Validation\ValidationException $error) {
            $status=422;throw $error;
        } catch (\Throwable $error) {
            $status=502;
            throw new HttpException(502,'The website CMS could not confirm this request. Reload before retrying a save. Reference: '.$correlation);
        } finally {
            DB::table('audit_logs')->insert(['user_id'=>$user->id,'resource'=>'website_cms','record_id'=>(int) $site['exhibition_id'],
                'action'=>'cms_'.substr($file ? 'upload' : ($input['operation'] ?? 'unknown'),0,20),
                'before'=>null,'after'=>json_encode(['site'=>$site['slug'],'resource'=>$resource,'correlation_id'=>$correlation,'status'=>$status]),
                'created_at'=>now(),'updated_at'=>now()]);
        }
    }
}
