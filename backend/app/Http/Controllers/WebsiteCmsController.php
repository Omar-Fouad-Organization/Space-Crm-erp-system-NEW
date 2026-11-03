<?php

namespace App\Http\Controllers;

use App\Services\{CmsGateway, PermissionPolicy};
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WebsiteCmsController extends Controller
{
    public function __construct(private CmsGateway $gateway, private PermissionPolicy $policy) {}

    public function sites(Request $request): array
    {
        $this->policy->authorize('website.view', $request->user());
        $sites = [];
        foreach (array_keys(config('cms_gateway.sites')) as $slug) {
            try {
                $site = $this->gateway->site($slug, $request->user());
                $site['exhibition_id'] = (int) $site['exhibition_id'];
                $sites[] = array_intersect_key($site, array_flip(['slug','name','exhibition_id','public_origin']));
            } catch (\Symfony\Component\HttpKernel\Exception\HttpException $error) {
                if ($error->getStatusCode() !== 404) {
                    throw $error;
                }
            }
        }
        return ['data'=>$sites];
    }

    public function query(Request $request, string $site, string $resource): array
    {
        $binding = $this->gateway->site($site, $request->user());
        if ($resource === 'overview') {
            return $this->gateway->send($binding, $resource, ['operation'=>'list'], $request->user());
        }
        $spec = $this->gateway->spec($resource);
        $this->policy->authorize($spec['family'].'.view', $request->user());
        $v = $request->validate(['operation'=>['required',Rule::in(['list','create','update','upsert','delete'])],
            'records'=>'sometimes|array','filters'=>'sometimes|array|max:20','orders'=>'sometimes|array|max:5',
            'limit'=>'sometimes|integer|min:1|max:100','offset'=>'sometimes|integer|min:0|max:10000',
            'expected_version'=>'present|nullable|string|size:64']);
        abort_if(array_diff(array_keys($request->all()), array_keys($v)), 422, 'Unsupported CMS request property.');
        $filters = $v['filters'] ?? [];
        foreach ($filters as $filter) {
            abort_unless(is_array($filter) && in_array($filter['column'] ?? null, $spec['filters'], true)
                && in_array($filter['operator'] ?? null, ['eq','neq','in'], true) && array_key_exists('value', $filter), 422, 'Unsupported CMS filter.');
        }
        if ($v['operation'] !== 'list') {
            if (in_array($v['operation'], ['create','update','delete'], true)) {
                $this->policy->authorize($spec['family'].'.'.(['update'=>'edit'][$v['operation']] ?? $v['operation']), $request->user());
            } else {
                abort_unless($this->policy->allows($spec['family'].'.create', $request->user()) || $this->policy->allows($spec['family'].'.edit', $request->user()), 403);
            }
            if ($spec['visible'] === null) $this->policy->authorize($spec['family'].'.publish', $request->user());
            $record = $v['records'] ?? [];
            if (array_is_list($record) && $record !== []) {
                abort_unless(count($record) === 1 && is_array($record[0]), 422, 'Select one CMS record.');
                $record = $record[0];
            }
            abort_if(array_diff(array_keys($record), [...array_keys($spec['fields']),'id','created_at','updated_at','_version']), 422, 'Unsupported CMS field.');
            $before = null;
            if (in_array($v['operation'], ['update','delete','upsert'], true)) {
                if ($v['operation'] === 'upsert') {
                    abort_unless($spec['unique'] !== [], 422);
                    $filters = [];
                    foreach ($spec['unique'] as $key) {
                        abort_unless(isset($record[$key]), 422, 'Complete CMS identity is required.');
                        $filters[] = ['column'=>$key,'operator'=>'eq','value'=>$record[$key]];
                    }
                }
                abort_unless($filters !== [], 422, 'Select a specific CMS record.');
                $equal=[];foreach($filters as $filter){abort_unless($filter['operator']==='eq',422,'Select a specific CMS identity.');$equal[$filter['column']]=$filter['value'];}
                abort_unless(isset($equal['id'])||($spec['unique']!==[]&&count(array_intersect($spec['unique'],array_keys($equal)))===count($spec['unique'])),422,'Select a specific CMS identity.');
                if ($spec['visible']!==null||$v['operation']==='upsert') {
                    $rows = $this->gateway->send($binding, $resource, ['operation'=>'list','filters'=>$filters,'limit'=>2,'expected_version'=>null], $request->user());
                    abort_if(count($rows['data']) > 1, 422, 'Select one CMS record.');
                    $before = $rows['data'][0] ?? null;
                    abort_if($before === null && $v['operation'] !== 'upsert', 404);
                }
            }
            $action = $v['operation'] === 'delete' ? 'delete' : ($v['operation']==='update'||$before ? 'edit' : 'create');
            $this->policy->authorize($spec['family'].'.'.$action, $request->user());
            $visible = $spec['visible'];
            if ($visible === null || ($before && ($before[$visible] ?? false))
                || ($v['operation'] !== 'delete' && ($record[$visible] ?? ($visible === 'is_active')))) {
                $this->policy->authorize($spec['family'].'.publish', $request->user());
            }
        }
        return $this->gateway->send($binding, $resource, $v, $request->user());
    }

    public function upload(Request $request, string $site): array
    {
        $binding = $this->gateway->site($site, $request->user());
        $this->policy->authorize('media.upload', $request->user());
        $v = $request->validate(['file'=>'required|file|mimes:jpg,jpeg,png,webp,gif,ico|max:5120',
            'bucket'=>['required',Rule::in(['premium_logos','premium_photos','partner_logos'])]]);
        return $this->gateway->send($binding, 'upload', [], $request->user(), $v['file']->getRealPath(), $v['bucket']);
    }
}
