<?php

namespace App\Http\Controllers;

use App\Services\{CrmService, PermissionPolicy};
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExportController extends Controller
{
    public function __construct(private PermissionPolicy $policy, private CrmService $crm) {}

    public function records(Request $request, string $resource)
    {
        abort_unless(isset(config('crm.resources')[$resource]), 404);
        $this->policy->authorize($resource.'.export', $request->user());
        $v = $request->validate(['ids' => 'present|array|max:1000', 'ids.*' => 'required|integer|distinct|min:1']);
        $this->crm->authorize($resource, $request->user());
        $rows = $this->crm->visible($resource, $request->user())->whereIn('id', $v['ids'])->orderBy('id')->get();
        abort_unless($rows->count() === count($v['ids']), 404, 'Record not found.');
        $this->crm->primeLabels($resource, $rows->all(), $request->user());
        $data = $rows->map(fn ($row) => $this->crm->present($resource, $row, $request->user()));
        // Audit only the selection count, never a second copy of exported private fields.
        $this->crm->audit('exports', 0, 'export', $request->user()->id, null, ['resource' => $resource, 'count' => $rows->count()]);
        return ['data' => $data];
    }

    public function report(Request $request)
    {
        $v = $request->validate(['report' => ['required', Rule::in(['dashboard', 'finance', 'profitability', 'collections', 'pipeline'])]]);
        $permission = ['dashboard' => 'dashboard.export', 'finance' => 'finance.export', 'profitability' => 'profitability.export', 'collections' => 'collections.export', 'pipeline' => 'deals.export'][$v['report']];
        $this->policy->authorize($permission, $request->user());
        // Report data comes from existing authorized, scoped report endpoints.
        // This gate records managed downloads of those already displayed projections.
        $this->crm->audit('exports', 0, 'export_report', $request->user()->id, null, ['report' => $v['report']]);
        return ['authorized' => true];
    }
}
