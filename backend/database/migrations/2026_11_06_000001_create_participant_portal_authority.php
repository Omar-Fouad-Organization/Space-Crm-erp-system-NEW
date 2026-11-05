<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('portal_identity_controls',function(Blueprint $t){$t->uuid('identity_id')->primary();$t->timestamp('disabled_at')->nullable();$t->text('reason')->nullable();$t->foreignId('reviewed_by')->constrained('users')->restrictOnDelete();$t->timestamps();});
        Schema::create('portal_memberships', function (Blueprint $t) {
            $t->uuid('id')->primary();
            // Website-owned UUID, never an employee/user-table foreign key.
            $t->uuid('identity_id')->index();
            $t->foreignId('participant_id')->constrained('b2b_participants')->restrictOnDelete();
            $t->foreignId('exhibition_id')->constrained('exhibitions')->restrictOnDelete();
            $t->string('role', 32); $t->json('capabilities');
            $t->string('status', 24)->default('pending');
            $t->text('approval_evidence');
            $t->foreignId('reviewed_by')->constrained('users')->restrictOnDelete();
            $t->timestamp('revoked_at')->nullable(); $t->timestamps();
            $t->unique(['identity_id','participant_id','exhibition_id'], 'portal_membership_binding');
        });
        Schema::create('portal_gateway_nonces', function (Blueprint $t) {
            $t->string('id',64)->primary(); $t->timestamp('expires_at')->index();
        });
        Schema::create('portal_access_invitations',function(Blueprint $t){
            $t->uuid('id')->primary();$t->foreignId('participant_id')->constrained('b2b_participants')->restrictOnDelete();
            $t->string('email');$t->string('token_hash',64)->unique();$t->string('role',32);$t->text('evidence');
            $t->foreignId('invited_by')->constrained('users')->restrictOnDelete();$t->timestamp('expires_at');$t->timestamp('revoked_at')->nullable();
            $t->uuid('redeemed_identity_id')->nullable();$t->uuid('membership_id')->nullable();$t->timestamps();
        });
        Schema::create('portal_commands', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('membership_id'); $t->foreign('membership_id')->references('id')->on('portal_memberships')->restrictOnDelete();
            $t->string('operation',40); $t->string('body_hash',64);
            $t->longText('result'); $t->timestamp('created_at');
        });
        Schema::create('portal_activity', function (Blueprint $t) {
            $t->id(); $t->uuid('membership_id')->index(); $t->uuid('identity_id')->index();
            $t->foreignId('exhibition_id')->constrained('exhibitions')->restrictOnDelete();
            $t->string('operation',40); $t->uuid('command_id')->nullable()->unique();
            $t->text('details'); $t->timestamp('created_at');
        });
        Schema::create('portal_amendments', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('membership_id')->index();
            $t->foreignId('participant_id')->constrained('b2b_participants')->restrictOnDelete();
            $t->unsignedInteger('profile_version'); $t->string('status',32)->default('submitted');
            $t->unsignedInteger('version')->default(1);$t->string('payload_hash',64);$t->unique(['participant_id','profile_version','payload_hash'],'portal_amendment_content');
            $t->longText('payload'); $t->text('review_note')->nullable();
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->restrictOnDelete(); $t->timestamps();
        });
        Schema::create('portal_publications', function (Blueprint $t) {
            $t->foreignId('participant_id')->primary()->constrained('b2b_participants')->restrictOnDelete();
            $t->unsignedInteger('profile_version'); $t->boolean('published')->default(false);
            $t->string('country',100)->nullable()->index();$t->string('sector',150)->nullable()->index();$t->text('search_text')->nullable();
            $t->json('categories')->nullable();
            $t->foreignId('reviewed_by')->constrained('users')->restrictOnDelete(); $t->timestamps();
        });
        Schema::create('portal_requests', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('membership_id')->index();
            $t->foreignId('exhibition_id')->constrained('exhibitions')->restrictOnDelete();
            $t->string('kind',32); $t->unsignedBigInteger('target_id');
            $t->string('status',32)->default('submitted');$t->unsignedInteger('version')->default(1); $t->text('payload'); $t->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('portal_requests'); Schema::dropIfExists('portal_publications'); Schema::dropIfExists('portal_amendments');
        Schema::dropIfExists('portal_activity'); Schema::dropIfExists('portal_commands');
        Schema::dropIfExists('portal_access_invitations');Schema::dropIfExists('portal_gateway_nonces'); Schema::dropIfExists('portal_memberships');
        Schema::dropIfExists('portal_identity_controls');
    }
};
