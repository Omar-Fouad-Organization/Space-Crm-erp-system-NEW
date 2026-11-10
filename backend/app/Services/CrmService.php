<?php

namespace App\Services;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CrmService
{
    public bool $approvedChange=false;
    private array $labels=[];
    public function primeLabels(string $resource,array $rows,$user=null): void {
        $ids=[];foreach($rows as $row){if($resource==='deals')$ids[]=$row->id;elseif(isset($row->deal_id))$ids[]=$row->deal_id;}if($resource==='payments')$ids=DB::table('payment_schedules')->whereIn('id',array_map(fn($row)=>$row->payment_schedule_id,$rows))->pluck('deal_id')->all();if($ids&&in_array($resource,['deals','payment_schedules','payments','invoices','commissions']))FinancialSnapshot::prime(array_values(array_unique($ids)));
        foreach(config("crm.resources.$resource.fields") as $key=>$field)if($field['type']==='relation'){
            $ids=array_values(array_unique(array_filter(array_map(fn($r)=>$r->$key??null,$rows))));
            $q = app(PermissionPolicy::class)->enabled() && $user ? $this->visible($field['resource'], $user) : DB::table($field['resource']);
            foreach($q->whereIn('id',$ids)->pluck('name','id') as $id=>$name)$this->labels[$field['resource']][$id]=$name;
        }
    }
    public function visible(string $resource,$user) { return app(RecordAccess::class)->query($resource,$user); }
    public function checkRecord(string $resource,int $id,$user): void {app(RecordAccess::class)->check($resource,$id,$user);}

    public const READ = [
        'management'=>['users'],
        'sales' => ['clients','exhibitions','booths','sponsorship_packages','deals','payment_schedules','proposals','tasks','meetings','documents','channels','messages','users'],
        'finance' => ['clients','exhibitions','deals','payment_schedules','payments','invoices','commissions','tasks','meetings','documents','users'],
        'operations' => ['clients','exhibitions','booths','sponsorship_packages','deals','tasks','meetings','documents','channels','messages','users'],
        'hr' => ['employees','users','tasks','meetings'],
        'support' => ['clients','deals','tickets','tasks','meetings','channels','messages','users'],
    ];
    public const WRITE = [
        'sales' => ['clients','deals','proposals','tasks','meetings','documents','channels','messages'],
        'finance' => ['payment_schedules','payments','invoices','commissions','tasks','meetings','documents'],
        'operations' => ['exhibitions','booths','sponsorship_packages','tasks','meetings','documents','channels','messages'],
        'hr' => ['employees','tasks','meetings'],
        'support' => ['tickets','tasks','meetings','channels','messages'],
    ];

    public function authorize(string $resource, $user, bool $write = false): array
    {
        $config = config('crm.resources')[$resource] ?? null;
        abort_unless($config, 404, 'Unknown module.');
        $policy = app(PermissionPolicy::class);
        if ($policy->enabled()) {
            $allowed = $write
                ? collect($resource === 'commissions' ? ['create', 'edit', 'delete', 'approve', 'pay'] : ['create', 'edit', 'delete'])->contains(fn ($action) => $policy->allows($resource.'.'.$action, $user))
                : $policy->allows($resource.'.view', $user);
            abort_unless($allowed, 403, 'You do not have permission for this operation.');
            return $config;
        }
        $admin = $user->role === 'super_admin';
        $manager = $user->role === 'management' && !in_array($resource, ['users','employees']);
        abort_unless($admin || $manager || in_array($resource, ($write ? self::WRITE : self::READ)[$user->role] ?? []), 403, 'You do not have permission for this operation.');
        return $config;
    }

    public function operation(string $resource, string $action, $user): void
    {
        if (app(PermissionPolicy::class)->enabled()) app(PermissionPolicy::class)->authorize($resource.'.'.$action, $user);
        else $this->authorize($resource, $user, $action !== 'view' && $action !== 'attachments.download');
    }

    public function cents($value): int
    {
        return BigDecimal::of((string) $value)->multipliedBy(100)->toScale(0, RoundingMode::UNNECESSARY)->toInt();
    }

    public function decimal(int $cents): string
    {
        return (string) BigDecimal::of($cents)->dividedBy(100, 2);
    }

    public function rows(string $resource, $user)
    {
        $this->authorize($resource, $user);
        $rows = $this->visible($resource,$user)->orderByDesc('id')->get();
        return $rows->map(fn ($row) => $this->present($resource, $row, $user));
    }

    public function present(string $resource, $row, $user): array
    {
        $data = (array) $row;
        $attributes=json_decode($data['attributes'] ?? '{}',true) ?: [];
        unset($data['attributes']);
        $data=[...$attributes,...$data];
        if ($resource === 'exhibitions') $data['booth_policy'] = app(BoothFootprintPolicy::class)->projection((int) $row->id);
        if ($resource === 'booths') $data['footprint_classification'] = $row->footprint_policy_version ? 'standard_policy' : 'legacy_or_area_only';
        unset($data['password'], $data['remember_token'],$data['mfa_secret'],$data['mfa_last_counter'],$data['auth_version'],$data['authorization_scoped'],$data['all_exhibitions']);
        if ($resource === 'users' && $user->role !== 'super_admin') return array_intersect_key($data, array_flip(['id','name','status']));
        if (app(PermissionPolicy::class)->enabled() && $resource === 'employees' && !app(PermissionPolicy::class)->allows('employees.salary.view', $user)) unset($data['salary']);
        $fields = config("crm.resources.$resource.fields");
        if (app(PermissionPolicy::class)->enabled() && in_array($resource, config('authorization.standalone_resources'))) {
            $fields['exhibition_id'] = ['type'=>'relation', 'resource'=>'exhibitions'];
        }
        foreach ($fields as $key => $field) {
            if ($field['type'] === 'relation' && !empty($data[$key])) {
                try { $this->authorize($field['resource'],$user); }
                catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) { unset($data[$key]); continue; }
                $label = $this->labels[$field['resource']][$data[$key]] ?? (app(PermissionPolicy::class)->enabled() ? $this->visible($field['resource'], $user) : DB::table($field['resource']))->where('id', $data[$key])->value('name');
                if ($label === null) { unset($data[$key], $data[$key.'_label']); continue; }
                $data[$key.'_label'] = $label;
            }
        }
        if ($resource === 'deals') {

            $data['paid_amount'] = $this->decimal(app(WorkflowService::class)->received($row->id));
            $data['credit_amount']=$this->decimal(app(WorkflowService::class)->credit($row->id));
            $data['remaining_amount'] = $this->decimal($this->cents($row->amount) - $this->cents($data['credit_amount']??0) - $this->cents($data['paid_amount']));
        }
        if ($resource === 'payment_schedules') {
            $data['paid_amount'] = $this->decimal(app(WorkflowService::class)->scheduleReceived($row->id));$data['credit_amount']=$this->decimal(app(WorkflowService::class)->scheduleCredit($row->id));
            $data['remaining_amount'] = $this->decimal($this->cents($row->amount) - $this->cents($data['credit_amount']??0) - $this->cents($data['paid_amount']));
            $data['status'] = $this->cents($data['remaining_amount']) === 0 ? 'paid' : ($row->due_date < date('Y-m-d') ? 'overdue' : 'pending');
            $relatedDeal=FinancialSnapshot::get()['deals'][$row->deal_id]??DB::table('deals')->find($row->deal_id);$data['currency']=$relatedDeal->currency;if($relatedDeal->status!=='closed_won')$data['status']='pending';
            $cache=FinancialSnapshot::get();$latest=isset($cache['schedules'][$row->id])?($cache['latest'][$row->id]??null):DB::table('payments')->where('payment_schedule_id',$row->id)->orderByDesc('paid_date')->orderByDesc('id')->first();
            $data['paid_date'] = $latest?->paid_date;
            $data['payment_method'] = $latest?->method;
        }
        if ($resource === 'payments') {
            $schedule = FinancialSnapshot::get()['schedules'][$row->payment_schedule_id]??DB::table('payment_schedules')->find($row->payment_schedule_id);
            $data['deal_id'] = $schedule->deal_id;
            $data['currency'] = FinancialSnapshot::get()['deals'][$schedule->deal_id]->currency??DB::table('deals')->where('id', $schedule->deal_id)->value('currency');
        }
        if ($resource === 'invoices' || $resource === 'commissions') {
            $deal = FinancialSnapshot::get()['deals'][$row->deal_id]??DB::table('deals')->find($row->deal_id);
            $data['currency'] = $deal->currency;
            if($resource==='commissions') $data['recovered_amount']=$this->decimal(app(WorkflowService::class)->approved('commission_recovery',$row->deal_id));
            if ($resource === 'invoices') {
                $dealData = $this->present('deals', $deal, $user);
                $data['amount'] = $deal->amount;
                $data['paid_amount'] = $dealData['paid_amount'];
                $data['remaining_amount'] = $dealData['remaining_amount'];
                $data['status'] = $this->cents($data['remaining_amount']) === 0 ? 'paid' : 'outstanding';
            }
        }
        if ($resource === 'documents') $data['attachments'] = DB::table('attachments')->where('document_id', $row->id)->get(['id','name','mime','size']);
        if ($resource === 'meetings') {
            $data['attendee_ids'] = DB::table('meeting_attendees')->where('meeting_id', $row->id)->pluck('user_id');
            $data['attendee_names'] = DB::table('users')->whereIn('id',$data['attendee_ids'])->pluck('name');
        }
        if ($resource === 'employees') $data['email'] = DB::table('users')->where('id',$row->user_id)->value('email');
        if (app(PermissionPolicy::class)->enabled() && !app(PermissionPolicy::class)->allows('financial.fields.view', $user)) {
            foreach (config("crm.resources.$resource.fields") as $key => $field) if ($field['type'] === 'money' && $key !== 'salary') unset($data[$key]);
            foreach (SensitiveFields::FINANCIAL as $key) unset($data[$key]);
        }
        if ($resource==='tasks') $data['b2b_source']=app(B2BFollowupTasks::class)->source((int)$row->id,$user);
        return $data;
    }

    public function save(string $resource, array $input, $user, ?int $id = null): array
    {
        $config = $this->authorize($resource, $user, !($this->approvedChange && app(PermissionPolicy::class)->enabled()));
        $policy = app(PermissionPolicy::class);
        if ($policy->enabled()) foreach (['authorization_scoped','all_exhibitions','permission_overrides','exhibition_ids','permissions'] as $key) {
            abort_if(array_key_exists($key, $input), 422, 'Use the confirmed authorization editor for security changes.');
        }
        $action = $resource === 'commissions' && $id && in_array($input['status'] ?? '', ['approved', 'paid']) ? (($input['status'] === 'paid') ? 'pay' : 'approve') : ($id ? 'edit' : 'create');
        if ($policy->enabled() && !$this->approvedChange) $policy->authorize($resource.'.'.$action, $user);
        if($id) $this->checkRecord($resource,$id,$user);
        if($resource==='deals' && !$this->approvedChange) {
            $old=$id ? DB::table('deals')->find($id):null;
            if((float)($input['discount_percentage']??0)>20 && (!$old || (float)$old->discount_percentage!==(float)$input['discount_percentage'])) $this->invalid('discount_percentage','Discounts above 20% require a workflow approval. Create the deal at the standard price, then request approval.');
            if((float)($input['commission_percentage']??0)>10 && (!$old || (float)$old->commission_percentage!==(float)$input['commission_percentage'])) $this->invalid('commission_percentage','Commission rates above 10% require a workflow approval.');

        }
        abort_if($resource === 'commissions' && !$id, 422, 'Commissions are generated from deals.');
        $rules = [];
        if ($policy->enabled() && in_array($resource, config('authorization.standalone_resources'), true)) {
            $rules['exhibition_id'] = ['sometimes', 'nullable', 'integer', 'exists:exhibitions,id'];
        }
        $rules['attributes']=['sometimes','nullable','array',function($attribute,$value,$fail) {
            if (!is_array($value)) return;
            if(strlen(json_encode($value))>100000) $fail('Additional fields are too large.');
            foreach(array_keys($value) as $key) {
                if(!preg_match('/^[a-zA-Z][a-zA-Z0-9_]{0,80}$/',$key) || preg_match('/(?:password|token|permission|permissions|auth_version|authorization_scoped|all_exhibitions|exhibition_ids|confirm_code|created_by|user_id|client_id|deal_id|booth_id|exhibition_id|salesperson_id|package_id|schedule_id|manager_id|organizer_id|channel_id)$/i',$key)) $fail('Relationship and security fields cannot be stored as additional fields.');
            }
        }];
        foreach ($config['fields'] as $key => $field) {
            $rule = ($field['required'] ?? false) ? 'required' : 'nullable';
            $type = match ($field['type']) {
                'relation' => 'integer|exists:'.$field['resource'].',id',
                'money', 'decimal' => 'numeric|min:0|decimal:0,2|max:9999999999999.99',
                'number' => 'integer|min:1|max:1000000',
                'date' => 'date_format:Y-m-d',
                'time' => 'date_format:H:i',
                'email' => 'email|max:255',
                'password' => 'string|min:12|max:128',
                'textarea' => 'string|max:50000',
                default => 'string|max:255',
            };
            $rules[$key] = [$rule, ...explode('|', $type)];
            if ($field['type'] === 'select') $rules[$key][] = Rule::in($field['options']);
        }
        if ($resource === 'booths') {
            foreach (['footprint_width_m', 'footprint_depth_m'] as $dimension) $rules[$dimension] = 'sometimes|nullable|numeric|min:0.01|max:9999.99|decimal:0,2';
            $rules['footprint_policy_version'] = 'prohibited';
        }
        if ($resource === 'users') {
            $rules['email'][] = Rule::unique('users')->ignore($id);
            if (!$id) $rules['password'][0] = 'required';
        }
        if (in_array($resource, ['payments','invoices'])) $rules['name'][] = Rule::unique($resource)->ignore($id);
        if ($resource === 'employees') $rules['user_id'][] = Rule::unique('employees')->ignore($id);
        if ($resource === 'deals') {
            $rules['commission_percentage'][] = 'max:100';
            $rules['discount_percentage'][] = 'max:100';
            $rules['tax_percentage'][] = 'max:100';
            $rules['installments'] = 'sometimes|array|max:60';
            $rules['installments.*.name'] = 'required|string|max:255';
            $rules['installments.*.amount'] = 'required|numeric|min:0.01|decimal:0,2';
            $rules['installments.*.due_date'] = 'required|date_format:Y-m-d';
        }
        if ($resource === 'meetings') {
            $rules['attendee_ids'] = 'sometimes|array|max:100';
            $rules['attendee_ids.*'] = 'integer|distinct|exists:users,id';
        }
        if ($policy->enabled()) {
            $references = array_filter($config['fields'], fn ($field) => $field['type'] === 'relation');
            if (isset($rules['exhibition_id'])) $references['exhibition_id'] = ['resource' => 'exhibitions'];
            foreach ($references as $field => $reference) {
                $value = $input[$field] ?? null;
                if ((is_int($value) || is_string($value)) && ctype_digit((string) $value) && (int) $value > 0) {
                    $this->authorize($reference['resource'], $user);
                    $this->checkRecord($reference['resource'], (int) $value, $user);
                }
            }
        }
        $validated = Validator::make($input, $rules)->validate();
        foreach ($config['fields'] as $key=>$field) {
            if ($field['type']==='relation' && !empty($validated[$key])) { $this->authorize($field['resource'],$user); $this->checkRecord($field['resource'],(int)$validated[$key],$user); }
        }
        return DB::transaction(function () use ($resource, $validated, $id, $user) {
            $before = $id ? DB::table($resource)->where('id', $id)->lockForUpdate()->first() : null;
            abort_if($id && !$before, 404, 'Record not found.');
            if ($resource==='messages' && $before && $before->created_by!==$user->id && !in_array($user->role,['super_admin','management'])) abort(403,'Only the author or an administrator can edit this message.');
            $data = $validated;
            if (app(PermissionPolicy::class)->enabled() && $resource === 'commissions' && $before) {
                foreach ($data as $key => $value) {
                    $changed = match ($key) {
                        'amount' => $this->cents($value) !== $this->cents($before->$key),
                        'attributes' => count(array_filter($value ?? [], fn ($v, $k) => $v != ((json_decode($before->attributes ?? '{}', true) ?: [])[$k] ?? null), ARRAY_FILTER_USE_BOTH)) > 0,
                        default => (string) $value !== (string) ($before->$key ?? ''),
                    };
                    if ($key !== 'status' && $changed) app(PermissionPolicy::class)->authorize('commissions.edit', $user);
                }
            }
            if ($resource==='tasks' && $before) app(B2BFollowupTasks::class)->validateTaskWrite($data,$before);
            app(ExhibitionAccess::class)->validateWrite($resource, $data, $before, $user);
            if (app(PermissionPolicy::class)->enabled()) {
                if ($resource === 'deals' && $before && !$this->approvedChange) {
                    foreach (['amount', 'base_price', 'discount_percentage', 'tax_percentage', 'commission_percentage'] as $field) {
                        if (array_key_exists($field, $data) && (($data[$field] === null || $before->$field === null)
                            ? $data[$field] !== $before->$field : $this->cents($data[$field]) !== $this->cents($before->$field))) app(PermissionPolicy::class)->authorize('deals.pricing.edit', $user);
                    }
                }
                if ($resource === 'employees' && array_key_exists('salary', $data) && (!$before || $this->cents($data['salary']) !== $this->cents($before->salary))) app(PermissionPolicy::class)->authorize('employees.salary.edit', $user);
                if ($resource === 'commissions' && $before && $data['status'] !== $before->status) app(PermissionPolicy::class)->authorize('commissions.'.($data['status'] === 'paid' ? 'pay' : 'approve'), $user);
                if ($resource === 'users' && !$before) $data['authorization_scoped'] = true;
            }
            if(isset($data['attributes'])) $data['attributes']=json_encode([...(json_decode($before->attributes ?? '{}',true) ?: []),...$data['attributes']]);
            $installments = $data['installments'] ?? null; unset($data['installments']);
            $attendees = $data['attendee_ids'] ?? null; unset($data['attendee_ids']);
            if ($resource === 'users') {
                if ($before && (!empty($data['password']) || $data['role'] !== $before->role
                    || $data['status'] !== $before->status || $data['email'] !== $before->email)) {
                    app(SessionRevocation::class)->revoke($id);
                }
                if (empty($data['password'])) unset($data['password']);
                else $data['password'] = Hash::make($data['password']);
                if ($id === $user->id && ($data['status'] !== 'active' || $data['role'] !== 'super_admin')) $this->invalid('role', 'You cannot disable or demote your own administrator account.');
                if ($before && $before->role === 'super_admin' && ($data['role'] !== 'super_admin' || $data['status'] !== 'active')) {
                    if (DB::table('users')->where('role','super_admin')->where('status','active')->count() < 2) $this->invalid('role','Keep at least one active administrator.');
                }
            }
            if ($resource === 'exhibitions' && $data['end_date'] < $data['start_date']) $this->invalid('end_date','End date must be on or after start date.');
            if ($resource === 'employees' && ($data['manager_id'] ?? null) == $data['user_id']) $this->invalid('manager_id','An employee cannot manage themselves.');
            if ($resource === 'booths') {
                app(BoothFootprintPolicy::class)->validate($data, $before);
                if ($this->cents($data['size_sqm']) <= 0) $this->invalid('size_sqm','Booth area must be greater than zero.');
                if (DB::table('booths')->where('exhibition_id',$data['exhibition_id'])->where('name',$data['name'])->when($id,fn($q)=>$q->where('id','!=',$id))->exists()) $this->invalid('name','This booth code already exists in that exhibition.');
                if ($before && $before->status !== 'available' && ($data['exhibition_id'] != $before->exhibition_id || $data['currency'] !== $before->currency)) $this->invalid('exhibition_id','A reserved or sold booth cannot change exhibition or currency.');
            }
            if ($resource === 'sponsorship_packages' && $before && DB::table('deals')->where('sponsorship_package_id',$id)->exists()) {
                if ($before->exhibition_id != $data['exhibition_id'] || $before->currency !== $data['currency']) $this->invalid('exhibition_id','A package used by deals cannot change exhibition or currency.');
            }
            if (isset($data['deal_id'])) {
                $deal = DB::table('deals')->where('id',$data['deal_id'])->lockForUpdate()->first();
                if (isset($data['client_id']) && $data['client_id'] != $deal->client_id) $this->invalid('client_id','The client must match the related deal.');
            }
            if ($resource === 'deals') $this->validateDeal($data, $before, $installments);
            if ($resource === 'payment_schedules') {
                if(!$this->approvedChange && (!$before || $before->due_date!==$data['due_date'])) { $expoId=DB::table('deals')->where('id',$data['deal_id'])->value('exhibition_id');$end=DB::table('exhibitions')->where('id',$expoId)->value('end_date');if($end && $data['due_date']>\Carbon\Carbon::parse($end)->addDays(30)->toDateString())$this->invalid('due_date','Installments beyond 30 days after the exhibition require payment terms approval.'); }
                $deal = DB::table('deals')->where('id',$data['deal_id'])->lockForUpdate()->first();
        if ($this->cents($data['amount']) <= 0) $this->invalid('amount','Installment must be greater than zero.');
                $allocated = DB::table('payment_schedules')->where('deal_id',$deal->id)->when($id,fn($q)=>$q->where('id','!=',$id))->sum('amount');
                if ($this->cents($allocated)+$this->cents($data['amount']) > $this->cents($deal->amount)) $this->invalid('amount','Installments cannot exceed the deal amount.');
                if ($id) {
                    if ($data['deal_id'] != $before->deal_id) $this->invalid('deal_id','An installment cannot be moved to another deal.');
                    $paid = $this->decimal(app(WorkflowService::class)->scheduleReceived($id));
                    if ($this->cents($data['amount']) < $this->cents($paid)) $this->invalid('amount','Amount cannot be less than received payments.');
                }
            }
            if ($resource === 'payments') {
                $schedule = DB::table('payment_schedules')->where('id',$data['payment_schedule_id'])->lockForUpdate()->first();
                $deal = DB::table('deals')->where('id',$schedule->deal_id)->lockForUpdate()->first();
                if ($deal->status !== 'closed_won') $this->invalid('payment_schedule_id','Close the deal as won before receiving payment.');
                if ($id && $before->payment_schedule_id != $data['payment_schedule_id']) $this->invalid('payment_schedule_id','A payment cannot be moved to another installment.');
                $paid = $this->decimal(app(WorkflowService::class)->scheduleReceived($schedule->id));
                if($id) $this->invalid('amount','Receipts are immutable. Request a reversal and record a corrected receipt.');
                if(app(WorkflowService::class)->received($deal->id)+$this->cents($data['amount'])>$this->cents($deal->amount)-app(WorkflowService::class)->credit($deal->id)) $this->invalid('amount','Payment exceeds the net deal balance after credit notes.');
                if ($this->cents($data['amount']) <= 0 || $this->cents($paid)+$this->cents($data['amount']) > $this->cents($schedule->amount)-app(WorkflowService::class)->scheduleCredit($schedule->id)) $this->invalid('amount','Payment must be positive and cannot exceed the installment balance.');

            }
            if ($resource === 'commissions') {
                if ($data['deal_id'] != $before->deal_id || $data['salesperson_id'] != $before->salesperson_id || $this->cents($data['amount']) !== $this->cents($before->amount)) $this->invalid('amount','Commission amounts and relationships are calculated from the deal.');
                $order = ['pending'=>0,'approved'=>1,'paid'=>2];
                if ($order[$data['status']] < $order[$before->status] || $order[$data['status']] > $order[$before->status]+1) $this->invalid('status','Approve a commission before paying it; paid commissions cannot be reversed here.');
                if ($data['status'] !== 'pending') {
                    $deal = DB::table('deals')->find($data['deal_id']);
                    $ids = DB::table('payment_schedules')->where('deal_id',$deal->id)->pluck('id');
                    $received = $this->decimal(app(WorkflowService::class)->received($deal->id));
                    if ($deal->status !== 'closed_won' || $this->cents($received) !== $this->cents($deal->amount)-app(WorkflowService::class)->credit($deal->id)) $this->invalid('status','The deal must be won and fully paid before commission approval.');
                }
            }
            if($resource==='deals' && $data['status']==='closed_won' && $before?->status!=='closed_won') $data['won_at']=now();
            $data['updated_at'] = now();
            if ($id) DB::table($resource)->where('id',$id)->update($data);
            else {
                $data['created_at'] = now();
                if ($resource !== 'users') $data['created_by'] = $user->id;
                $id = DB::table($resource)->insertGetId($data);
            }
            if ($resource === 'deals') {
                if ($installments !== null && !$before) {
                    foreach ($installments as $item) $this->insert('payment_schedules', [...$item,'deal_id'=>$id],$user->id);
                }
                $commission = DB::table('commissions')->where('deal_id',$id)->first();
                $amount = in_array($data['status'],['closed_lost','cancelled']) ? '0.00' : (string) BigDecimal::of($data['base_price'] ?? $data['amount'])->multipliedBy($data['commission_percentage'] ?? 0)->dividedBy(100,2,RoundingMode::HALF_UP);
                if (!$commission && $this->cents($amount)>0) $this->insert('commissions',['name'=>'Commission — '.$data['name'],'deal_id'=>$id,'salesperson_id'=>$data['salesperson_id'],'amount'=>$amount,'status'=>'pending'],$user->id);
                elseif ($commission && $commission->status === 'pending') DB::table('commissions')->where('id',$commission->id)->update(['salesperson_id'=>$data['salesperson_id'],'amount'=>$amount,'updated_at'=>now()]);
                if ($before?->booth_id && $before->booth_id != ($data['booth_id'] ?? null)) $this->syncBooth($before->booth_id);
                if (!empty($data['booth_id'])) $this->syncBooth($data['booth_id']);
            }
            if ($resource === 'meetings' && $attendees !== null) {
                DB::table('meeting_attendees')->where('meeting_id',$id)->delete();
                foreach ($attendees as $uid) DB::table('meeting_attendees')->insert(['meeting_id'=>$id,'user_id'=>$uid]);
            }
            $after = DB::table($resource)->find($id);
            $this->audit($resource,$id,$before ? 'update' : 'create',$user->id,$before,$after);
            return $this->present($resource,$after,$user);
        }, 3);
    }

    private function validateDeal(array &$data, $before, ?array $installments): void
    {
        if (isset($data['base_price'])) {
            $base = BigDecimal::of($data['base_price']);
            $discount = $base->multipliedBy($data['discount_percentage'] ?? 0)->dividedBy(100,2,RoundingMode::HALF_UP);
            $net = $base->minus($discount);
            $tax = $net->multipliedBy($data['tax_percentage'] ?? 0)->dividedBy(100,2,RoundingMode::HALF_UP);
            if ($this->cents($net->plus($tax)) !== $this->cents($data['amount'])) $this->invalid('amount','Total must equal base price minus discount plus tax.');
        }
        if ($this->cents($data['amount']) <= 0) $this->invalid('amount','Deal amount must be greater than zero.');
        if (!DB::table('users')->where('id',$data['salesperson_id'])->where('status','active')->whereIn('role',['sales','management','super_admin'])->exists()) $this->invalid('salesperson_id','Choose an active sales, management, or administrator account.');
        if ($data['type'] === 'booth') {
            if (empty($data['booth_id']) || !empty($data['sponsorship_package_id'])) $this->invalid('booth_id','A booth deal requires one booth and no sponsorship package.');
            $booth = DB::table('booths')->where('id',$data['booth_id'])->lockForUpdate()->first();
            if ($booth->exhibition_id != $data['exhibition_id'] || $booth->currency !== $data['currency']) $this->invalid('booth_id','Booth exhibition and currency must match the deal.');
            // A locking read sees the winner after waiting on the booth lock, even under REPEATABLE READ.
            $occupied = DB::table('deals')->where('booth_id',$booth->id)->whereNotIn('status',['closed_lost','cancelled'])->when($before,fn($q)=>$q->where('id','!=',$before->id))->lockForUpdate()->first(['id']);
            if ($occupied && !in_array($data['status'],['closed_lost','cancelled'])) $this->invalid('booth_id','This booth is already reserved or sold.');
        } else {
            if (empty($data['sponsorship_package_id']) || !empty($data['booth_id'])) $this->invalid('sponsorship_package_id','A sponsorship deal requires a package and no booth.');
            $package = DB::table('sponsorship_packages')->find($data['sponsorship_package_id']);
            if ($package->exhibition_id != $data['exhibition_id'] || $package->currency !== $data['currency']) $this->invalid('sponsorship_package_id','Package exhibition and currency must match the deal.');
        }
        if ($before) {
            if ($before->client_id != $data['client_id']) {
                foreach (['tasks','meetings','documents','tickets'] as $table) {
                    if (DB::table($table)->where('deal_id',$before->id)->whereNotNull('client_id')->where('client_id','!=',$data['client_id'])->exists()) $this->invalid('client_id','Related records still reference the original client. Update those relationships before changing the deal client.');
                }
            }
            $commission = DB::table('commissions')->where('deal_id',$before->id)->first();
            if ($commission && $commission->status !== 'pending') {
                foreach (['amount','base_price','discount_percentage','tax_percentage','commission_percentage','salesperson_id','status','client_id','exhibition_id','booth_id','sponsorship_package_id','currency','type'] as $key) {
                    if (($before->$key ?? '') != ($data[$key] ?? '')) $this->invalid($key,'Financial relationships are locked after commission approval.');
                }
            }
            $ids = DB::table('payment_schedules')->where('deal_id',$before->id)->pluck('id');
            if ($ids->isNotEmpty()) {
                foreach (['client_id','currency','exhibition_id','booth_id','sponsorship_package_id','type'] as $key) if (($before->$key ?? '') != ($data[$key] ?? '')) $this->invalid($key,'Remove unpaid installments before changing the deal relationship.');
                $allocated = DB::table('payment_schedules')->where('deal_id',$before->id)->sum('amount');
                if ($this->cents($data['amount']) < $this->cents($allocated)) $this->invalid('amount','Deal amount cannot be less than allocated installments.');
                $paid = DB::table('payments')->whereIn('payment_schedule_id',$ids)->sum('amount');
                if ($this->cents($paid)>0 && $data['status'] !== 'closed_won') $this->invalid('status','A deal with received payments must remain closed won.');
            }
            if ($installments !== null) $this->invalid('installments','Manage existing installments in Payment schedules.');
        } elseif ($installments !== null) {
            $total = array_sum(array_map(fn($item)=>$this->cents($item['amount']),$installments));
            if ($total !== $this->cents($data['amount'])) $this->invalid('installments','Installments must add up exactly to the deal amount.');
        }
    }

    public function insert(string $resource,array $data,int $actor): int
    {
        return DB::table($resource)->insertGetId([...$data,'created_by'=>$actor,'created_at'=>now(),'updated_at'=>now()]);
    }

    public function syncBooth(int $id): void
    {
        $deal = DB::table('deals')->where('booth_id',$id)->whereNotIn('status',['cancelled','closed_lost'])->first();
        DB::table('booths')->where('id',$id)->update(['status'=>$deal ? ($deal->status === 'closed_won' ? 'sold' : 'reserved') : 'available','updated_at'=>now()]);
    }

    public function delete(string $resource,int $id,$user): void
    {
        $this->authorize($resource,$user,true);
        if (app(PermissionPolicy::class)->enabled()) app(PermissionPolicy::class)->authorize($resource.'.delete', $user);
        $this->checkRecord($resource,$id,$user);
        abort_if(in_array($resource,['payments','commissions','invoices']),422,'Financial records cannot be deleted. Correct them through a reviewed accounting adjustment.');
        abort_if($resource==='users' && $id===$user->id,422,'You cannot delete your own account.');
        try {
            DB::transaction(function () use ($resource,$id,$user) {
                $before=DB::table($resource)->where('id',$id)->lockForUpdate()->first();
                abort_unless($before,404,'Record not found.');
                if(DB::table('reminders')->where('resource',$resource)->where('record_id',$id)->whereIn('status',['pending','failed'])->exists())$this->invalid('id','Cancel active reminders before deleting this record.');
                if ($resource==='messages' && $before->created_by!==$user->id && !in_array($user->role,['super_admin','management'])) abort(403,'Only the author or an administrator can delete this message.');
                if ($resource==='documents' && DB::table('attachments')->where('document_id',$id)->exists()) $this->invalid('id','Remove document attachments before deleting the document.');
                DB::table($resource)->where('id',$id)->delete();
                if ($resource==='deals' && $before->booth_id) $this->syncBooth($before->booth_id);
                $this->audit($resource,$id,'delete',$user->id,$before,null);
            });
        } catch (QueryException $e) {
            if ($e->getCode()==='23000') $this->invalid('id','This record is used by related records. Remove those relationships first.');
            throw $e;
        }
    }

    public function audit(string $resource,int $id,string $action,int $actor,$before,$after): void
    {
        $redact = function ($data) { $data=(array)$data; unset($data['password'],$data['remember_token'],$data['mfa_secret'],$data['mfa_last_counter'],$data['auth_version']); return $data; };
        DB::table('audit_logs')->insert(['user_id'=>$actor,'resource'=>$resource,'record_id'=>$id,'action'=>$action,'before'=>$before ? json_encode($redact($before)) : null,'after'=>$after ? json_encode($redact($after)) : null,'created_at'=>now(),'updated_at'=>now()]);
        DB::table('notifications')->insert(['user_id'=>$actor,'name'=>ucfirst($action).' '.str_replace('_',' ',$resource).' #'.$id,'resource'=>$resource,'record_id'=>$id,'created_at'=>now(),'updated_at'=>now()]);
    }

    private function invalid(string $field,string $message): never
    {
        throw ValidationException::withMessages([$field=>$message]);
    }
}
