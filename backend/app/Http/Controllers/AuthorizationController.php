<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\{CrmService, PermissionPolicy, SessionRevocation, Totp};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Crypt, DB, Hash};
use Illuminate\Validation\Rule;

class AuthorizationController extends Controller
{
    public function __construct(private PermissionPolicy $policy) {}

    public function me(Request $request) { return $this->policy->contract($request->user()); }

    public function catalog(Request $request)
    {
        $this->policy->authorize('permissions.manage', $request->user());
        return ['enabled' => $this->policy->enabled(), 'registry' => $this->policy->registry(),
            'reserved_namespaces' => config('authorization.reserved_namespaces'),
            'users' => DB::table('users')->orderBy('name')->get(['id', 'name', 'role', 'status']),
            'exhibitions' => DB::table('exhibitions')->orderBy('name')->get(['id', 'name']),
            'teams' => DB::table('teams')->orderBy('name')->get(['id', 'name'])];
    }

    private function configuration(User $user): array
    {
        $overrides = $this->policy->overrides($user); ksort($overrides);
        $exhibitions = DB::table('exhibition_user')->where('user_id', $user->id)->orderBy('exhibition_id')->pluck('exhibition_id')->map(fn ($id) => (int) $id)->all();
        return ['authorization_scoped' => (bool) $user->authorization_scoped, 'all_exhibitions' => (bool) $user->all_exhibitions,
            'record_scope' => $user->record_scope, 'team_id' => $user->team_id, 'exhibition_ids' => $exhibitions, 'overrides' => $overrides];
    }

    public function show(Request $request, int $id)
    {
        $this->policy->authorize('permissions.manage', $request->user());
        abort_unless($this->policy->enabled(), 409, 'Granular authorization is disabled pending schema verification and rollout approval.');
        $user = User::findOrFail($id);
        return ['user' => ['id' => $user->id, 'name' => $user->name, 'role' => $user->role, 'status' => $user->status],
            'version' => $user->auth_version, 'configuration' => $this->configuration($user),
            'effective' => $this->policy->contract($user),
            'history' => DB::table('audit_logs')->where('resource', 'authorization')->where('record_id', $id)->orderByDesc('id')->limit(50)->get(['id', 'action', 'user_id', 'before', 'after', 'created_at'])];
    }

    public function update(Request $request, int $id)
    {
        $this->policy->authorize('permissions.manage', $request->user());
        $this->policy->authorize('exhibitions.manage_access', $request->user());
        abort_unless($this->policy->enabled(), 409, 'Granular authorization is not enabled.');
        abort_if($id === $request->user()->id, 422, 'You cannot change your own security policy.');
        $v = $request->validate([
            'version' => 'required|integer|min:0', 'authorization_scoped' => 'required|boolean', 'all_exhibitions' => 'required|boolean',
            'record_scope' => ['required', Rule::in(['all', 'team', 'own'])], 'team_id' => 'nullable|integer|exists:teams,id',
            'exhibition_ids' => 'present|array|max:500', 'exhibition_ids.*' => 'required|integer|distinct|exists:exhibitions,id',
            'overrides' => 'present|array|max:500', 'overrides.*.permission' => ['required', 'string', 'distinct', Rule::in(array_keys($this->policy->registry()))],
            'overrides.*.effect' => ['required', Rule::in(['allow', 'deny'])],
            'password' => 'required|string|max:128', 'code' => 'nullable|string|size:6', 'reason' => 'required|string|min:8|max:1000',
        ]);
        abort_if($v['record_scope'] === 'team' && empty($v['team_id']), 422, 'Select a team.');
        foreach ($v['overrides'] as $override) abort_if($this->policy->registry()[$override['permission']]['protected'], 422, 'Security administration permissions cannot be overridden.');
        foreach ($v['overrides'] as $override) abort_if(isset($this->policy->registry()[$override['permission']]['unavailable_reason']), 422, 'This operation is prohibited by a business invariant.');
        DB::transaction(function () use ($request, $id, $v) {
            $locked = User::whereIn('id', [$id, $request->user()->id])->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $actor = $locked[$request->user()->id]; $target = $locked[$id] ?? null;
            abort_unless($target, 404);
            abort_unless($actor->status === 'active' && $actor->role === 'super_admin'
                && (int) $request->session()->get(SessionRevocation::STAMP.'.version') === $actor->auth_version, 401, 'Please sign in again.');
            abort_if($target->role === 'super_admin', 422, 'Super Admin authority cannot be changed through permission overrides.');
            abort_unless(Hash::check($v['password'], $actor->password), 422, 'Current password is incorrect.');
            abort_if($target->auth_version !== (int) $v['version'], 409, 'Access was changed. Reload before saving.');
            abort_if($target->authorization_scoped && !$v['authorization_scoped'], 422, 'Restricted mode cannot be disabled. Use an explicit all-exhibitions grant.');
            if ($actor->mfa_confirmed_at) {
                $counter = app(Totp::class)->verify(Crypt::decryptString($actor->mfa_secret), $v['code'] ?? '', $actor->mfa_last_counter);
                abort_if($counter === null, 422, 'Enter a valid, unused authenticator code.');
                $actor->forceFill(['mfa_last_counter' => $counter])->save();
            }
            $before = $this->configuration($target);
            $overrides = []; foreach ($v['overrides'] as $entry) $overrides[$entry['permission']] = $entry['effect'] === 'allow'; ksort($overrides);
            $ids = array_map('intval', $v['exhibition_ids']); sort($ids);
            $after = ['authorization_scoped' => $v['authorization_scoped'], 'all_exhibitions' => $v['all_exhibitions'],
                'record_scope' => $v['record_scope'], 'team_id' => $v['team_id'] ?? null, 'exhibition_ids' => $ids, 'overrides' => $overrides];
            if ($before == $after) return;
            DB::table('users')->where('id', $id)->update(array_intersect_key($after, array_flip(['authorization_scoped', 'all_exhibitions', 'record_scope', 'team_id'])));
            DB::table('exhibition_user')->where('user_id', $id)->delete();
            foreach ($ids as $event) DB::table('exhibition_user')->insert(['user_id' => $id, 'exhibition_id' => $event, 'granted_by' => $actor->id, 'created_at' => now(), 'updated_at' => now()]);
            DB::table('user_permission_overrides')->where('user_id', $id)->delete();
            foreach ($overrides as $permission => $allowed) DB::table('user_permission_overrides')->insert(['user_id' => $id, 'permission' => $permission, 'allowed' => $allowed, 'granted_by' => $actor->id, 'created_at' => now(), 'updated_at' => now()]);
            app(SessionRevocation::class)->revoke($id);
            app(CrmService::class)->audit('authorization', $id, 'access_changed', $actor->id, $before, [...$after, 'reason' => $v['reason']]);
        });
        return $this->show($request, $id);
    }
}
