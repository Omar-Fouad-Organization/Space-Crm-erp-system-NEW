<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;

class IntakeAccess
{
    public function __construct(private PermissionPolicy $policy) {}

    public function authorize(string $permission, $user): void
    {
        abort_unless(config('intake.enabled') && $this->policy->enabled(),503,'Registration management is not activated.');
        $this->policy->authorize($permission,$user);
    }

    public function query($user, ?string $family = null)
    {
        $q=DB::table('intake_submissions');
        $types=array_filter(IntakePayload::TYPES,fn($type)=>($family===null || IntakePayload::family($type)===$family) && $this->policy->allows(IntakePayload::family($type).'.view',$user));
        $q->whereIn('type',$types);
        $ids=$this->policy->exhibitionIds($user);
        if ($ids!==null) { $q->whereIn('exhibition_id',$ids); }
        if ($user->role!=='super_admin' && ($user->record_scope??'all')!=='all') {
            $q->whereIn('assigned_user_id',$this->policy->owners($user));
        }
        return $q;
    }

    public function record(int $id, $user, bool $lock=false): object
    {
        abort_unless(config('intake.enabled') && $this->policy->enabled(),503);
        $q=$this->query($user)->where('id',$id);
        if ($lock) { $q->lockForUpdate(); }
        $row=$q->first();
        abort_unless($row,404,'Submission not found.');
        return $row;
    }

    public function event(int $event, $user): void
    {
        abort_unless($this->policy->canExhibition($event,$user) && DB::table('exhibitions')->where('id',$event)->exists(),404);
    }
}
