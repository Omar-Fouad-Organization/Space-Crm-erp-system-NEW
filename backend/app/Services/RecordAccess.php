<?php
namespace App\Services;
use Illuminate\Support\Facades\DB;
class RecordAccess
{
    public function query(string $resource, $user)
    {
        $q = app(ExhibitionAccess::class)->apply(DB::table($resource), $resource, $user);
        if (
            $user->role === 'super_admin' ||
            ($user->role === 'management' && !app(PermissionPolicy::class)->scoped($user)) ||
            ($user->record_scope ?? "all") === "all" ||
            in_array($resource, [
                "users",
                "exhibitions",
                "booths",
                "sponsorship_packages",
            ])
        ) {
            return $q;
        }
        $owners =
            $user->record_scope === "team" && $user->team_id
                ? DB::table("users")
                    ->where("team_id", $user->team_id)
                    ->pluck("id")
                    ->all()
                : [$user->id];
        $deals = DB::table("deals")
            ->whereIn("salesperson_id", $owners)
            ->orWhereIn("created_by", $owners)
            ->pluck("id");
        $clients = DB::table("deals")
            ->whereIn("id", $deals)
            ->pluck("client_id");
        $channels = DB::table("channels")
            ->whereIn("deal_id", $deals)
            ->orWhereIn("created_by", $owners)
            ->pluck("id");
        return $q->where(function ($q) use (
            $resource,
            $owners,
            $deals,
            $clients,
            $channels,
            $user,
        ) {
            if ($resource === "deals") {
                $q->whereIn("id", $deals);
            } elseif ($resource === "clients") {
                $q->whereIn("id", $clients)->orWhereIn("created_by", $owners);
                if (app(PermissionPolicy::class)->scoped($user)) {
                    foreach (['tasks', 'meetings', 'documents', 'tickets'] as $work) {
                        $related = app(ExhibitionAccess::class)->apply(DB::table($work), $work, $user)->whereNotNull('client_id');
                        $related->where(function ($w) use ($work, $owners) {
                            $w->whereIn('created_by', $owners);
                            foreach (['assigned_user_id', 'organizer_id'] as $field) if (isset(config('crm.resources.'.$work.'.fields')[$field])) $w->orWhereIn($field, $owners);
                        });
                        $q->orWhereIn('id', $related->select('client_id'));
                    }
                }
            } elseif ($resource === "payments") {
                $q->whereIn(
                    "payment_schedule_id",
                    DB::table("payment_schedules")
                        ->whereIn("deal_id", $deals)
                        ->pluck("id"),
                );
            } elseif ($resource === "messages") {
                $q->whereIn("channel_id", $channels);
            } elseif ($resource === "channels") {
                $q->whereIn("id", $channels);
            } elseif ($resource === "employees") {
                $q->whereIn("user_id", $owners);
            } else {
                $fields = config("crm.resources.$resource.fields", []);
                $q->whereIn("created_by", $owners);
                if (isset($fields["deal_id"])) {
                    $q->orWhereIn("deal_id", $deals);
                }
                if (isset($fields["client_id"])) {
                    $q->orWhere(function ($q) use ($fields, $clients) {
                        $q->whereIn("client_id", $clients);
                        if (isset($fields["deal_id"])) {
                            $q->whereNull("deal_id");
                        }
                    });
                }
                if (isset($fields["assigned_user_id"])) {
                    $q->orWhereIn("assigned_user_id", $owners);
                }
                if (isset($fields["organizer_id"])) {
                    $q->orWhereIn("organizer_id", $owners);
                }
            }
        });
    }
    public function check(string $resource, int $id, $user): void
    {
        abort_unless(
            $this->query($resource, $user)->where("id", $id)->exists(),
            404,
            "Record not found.",
        );
    }
}
