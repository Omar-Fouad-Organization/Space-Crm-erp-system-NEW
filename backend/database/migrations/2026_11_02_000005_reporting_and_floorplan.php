<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{Schema, DB};
return new class extends Migration {
    public function up(): void
    {
        Schema::table(
            "deals",
            fn(Blueprint $t) => $t->timestamp("won_at")->nullable()->index(),
        );
        foreach (
            DB::table("deals")->where("status", "closed_won")->get()
            as $deal
        ) {
            $at = null;
            foreach (
                DB::table("audit_logs")
                    ->where("resource", "deals")
                    ->where("record_id", $deal->id)
                    ->orderBy("id")
                    ->get()
                as $log
            ) {
                $after = json_decode($log->after ?? "{}", true);
                $before = json_decode($log->before ?? "{}", true);
                if (
                    ($after["status"] ?? "") === "closed_won" &&
                    ($before["status"] ?? "") !== "closed_won"
                ) {
                    $at = $log->created_at;
                    break;
                }
            }
            DB::table("deals")
                ->where("id", $deal->id)
                ->update(["won_at" => $at ?? $deal->updated_at]);
        }
        Schema::table(
            "workflow_requests",
            fn(Blueprint $t) => $t
                ->foreignId("payment_schedule_id")
                ->nullable()
                ->constrained()
                ->restrictOnDelete(),
        );
        Schema::create("booth_layouts", function (Blueprint $t) {
            $t->id();
            $t->foreignId("booth_id")
                ->unique()
                ->constrained()
                ->restrictOnDelete();
            $t->unsignedInteger("x");
            $t->unsignedInteger("y");
            $t->unsignedInteger("width");
            $t->unsignedInteger("height");
            $t->foreignId("created_by")
                ->constrained("users")
                ->restrictOnDelete();
            $t->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists("booth_layouts");
        Schema::table("workflow_requests", function (Blueprint $t) {
            $t->dropForeign(["payment_schedule_id"]);
            $t->dropColumn("payment_schedule_id");
        });
        Schema::table("deals", fn(Blueprint $t) => $t->dropColumn("won_at"));
    }
};
