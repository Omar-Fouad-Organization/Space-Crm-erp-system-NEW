<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void
    {
        Schema::table("users", function (Blueprint $t) {
            $t->string("record_scope")->default("all");
            $t->unsignedBigInteger("team_id")->nullable()->index();
            $t->text("mfa_secret")->nullable();
            $t->timestamp("mfa_confirmed_at")->nullable();
            $t->unsignedBigInteger("mfa_last_counter")->nullable();
        });
        Schema::create("teams", function (Blueprint $t) {
            $t->id();
            $t->string("name")->unique();
            $t->timestamps();
        });
        Schema::table(
            "users",
            fn(Blueprint $t) => $t
                ->foreign("team_id")
                ->references("id")
                ->on("teams")
                ->restrictOnDelete(),
        );
        Schema::table("deals", function (Blueprint $t) {
            $t->timestamp("reservation_expires_at")->nullable()->index();
            $t->index(["status", "expected_close_date"]);
        });
        Schema::table("clients", fn(Blueprint $t) => $t->index("email"));
        Schema::create("workflow_requests", function (Blueprint $t) {
            $t->id();
            $t->string("kind");
            $t->foreignId("deal_id")->constrained()->restrictOnDelete();
            $t->foreignId("payment_id")
                ->nullable()
                ->constrained()
                ->restrictOnDelete();
            $t->foreignId("commission_id")
                ->nullable()
                ->constrained()
                ->restrictOnDelete();
            $t->decimal("amount", 15, 2)->nullable();
            $t->json("payload")->nullable();
            $t->text("reason");
            $t->string("status")->default("pending")->index();
            $t->foreignId("requested_by")
                ->constrained("users")
                ->restrictOnDelete();
            $t->foreignId("reviewed_by")
                ->nullable()
                ->constrained("users")
                ->restrictOnDelete();
            $t->text("review_note")->nullable();
            $t->timestamp("reviewed_at")->nullable();
            $t->timestamps();
        });
        Schema::create("expenses", function (Blueprint $t) {
            $t->id();
            $t->foreignId("exhibition_id")->constrained()->restrictOnDelete();
            $t->string("name");
            $t->string("category");
            $t->decimal("amount", 15, 2);
            $t->string("currency", 3);
            $t->date("expense_date");
            $t->string("reference")->unique();
            $t->foreignId("created_by")
                ->constrained("users")
                ->restrictOnDelete();
            $t->timestamps();
        });
        Schema::create("collection_notes", function (Blueprint $t) {
            $t->id();
            $t->foreignId("payment_schedule_id")
                ->constrained()
                ->restrictOnDelete();
            $t->foreignId("assigned_user_id")
                ->constrained("users")
                ->restrictOnDelete();
            $t->text("note");
            $t->date("next_follow_up")->nullable();
            $t->foreignId("created_by")
                ->constrained("users")
                ->restrictOnDelete();
            $t->timestamps();
        });
        Schema::create("reminders", function (Blueprint $t) {
            $t->id();
            $t->foreignId("user_id")->constrained()->restrictOnDelete();
            $t->string("resource");
            $t->unsignedBigInteger("record_id");
            $t->string("name");
            $t->timestamp("send_at")->index();
            $t->string("channel")->default("in_app");
            $t->string("status")->default("pending")->index();
            $t->unsignedInteger("attempts")->default(0);
            $t->text("last_error")->nullable();
            $t->timestamp("delivered_at")->nullable();
            $t->foreignId("created_by")
                ->constrained("users")
                ->restrictOnDelete();
            $t->timestamps();
        });
    }
    public function down(): void
    {
        foreach (
            ["reminders", "collection_notes", "expenses", "workflow_requests"]
            as $table
        ) {
            Schema::dropIfExists($table);
        }
        Schema::table("clients", fn(Blueprint $t) => $t->dropIndex(["email"]));
        Schema::table("deals", function (Blueprint $t) {
            $t->dropIndex(["status", "expected_close_date"]);
            $t->dropColumn("reservation_expires_at");
        });
        Schema::table("users", function (Blueprint $t) {
            $t->dropForeign(["team_id"]);
            $t->dropColumn([
                "record_scope",
                "team_id",
                "mfa_secret",
                "mfa_confirmed_at",
                "mfa_last_counter",
            ]);
        });
        Schema::dropIfExists("teams");
    }
};
