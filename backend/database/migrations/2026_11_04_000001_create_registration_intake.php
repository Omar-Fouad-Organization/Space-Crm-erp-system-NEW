<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void
    {
        Schema::create('intake_nonces',function(Blueprint $t){$t->char('id',64)->primary();$t->timestamp('expires_at')->index();});
        Schema::create('registration_controls',function(Blueprint $t){
            $t->id();$t->string('site',80);$t->foreignId('exhibition_id')->constrained()->restrictOnDelete();$t->string('type',30);
            $t->boolean('enabled')->default(false);$t->boolean('dates_approved')->default(false);$t->json('visit_dates')->nullable();
            $t->string('timezone',80)->default('Africa/Cairo');$t->timestamp('opens_at')->nullable();$t->timestamp('closes_at')->nullable();
            $t->string('policy_version',80)->nullable();$t->text('privacy_notice_en')->nullable();$t->text('privacy_notice_ar')->nullable();$t->unsignedInteger('version')->default(1);$t->foreignId('updated_by')->constrained('users')->restrictOnDelete();$t->timestamps();
            $t->unique(['site','exhibition_id','type']);
        });
        Schema::create('buyer_organizations',function(Blueprint $t){$t->id();$t->string('name');$t->string('country',100);$t->string('website',2048)->nullable();$t->foreignId('created_by')->constrained('users')->restrictOnDelete();$t->timestamps();});
        Schema::create('intake_submissions',function(Blueprint $t){
            $t->id();$t->uuid('source_id');$t->string('source_system',50);$t->string('site',80);$t->string('source_form',80);$t->string('type',30);
            $t->foreignId('exhibition_id')->constrained()->restrictOnDelete();$t->boolean('historical')->default(false);$t->longText('original_payload');
            $t->char('source_hash',64);$t->string('name');$t->string('email');$t->string('phone',60)->nullable();$t->string('company')->nullable();
            $t->string('country',100);$t->string('language',5);$t->json('interests')->nullable();$t->timestamp('submitted_at');
            $t->string('status',40);$t->foreignId('assigned_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->foreignId('client_id')->nullable()->constrained()->restrictOnDelete();$t->foreignId('buyer_organization_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('duplicate_of')->nullable()->constrained('intake_submissions')->restrictOnDelete();$t->string('duplicate_review',30)->default('unreviewed');
            $t->timestamp('withdrawn_at')->nullable();$t->timestamp('redacted_at')->nullable();$t->unsignedInteger('version')->default(1);$t->timestamps();
            $t->unique(['site','source_id']);$t->index(['exhibition_id','type','status']);$t->index(['assigned_user_id','status']);$t->index('email');$t->index('phone');$t->index('company');
        });
        Schema::create('intake_inbox',function(Blueprint $t){$t->uuid('id')->primary();$t->char('payload_hash',64);$t->foreignId('submission_id')->constrained('intake_submissions')->restrictOnDelete();$t->timestamp('accepted_at');});
        Schema::create('intake_history',function(Blueprint $t){$t->id();$t->foreignId('submission_id')->constrained('intake_submissions')->restrictOnDelete();$t->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();$t->string('action',50);$t->string('from_status',40)->nullable();$t->string('to_status',40)->nullable();$t->text('reason')->nullable();$t->timestamp('created_at');});
        Schema::create('intake_activities',function(Blueprint $t){$t->id();$t->foreignId('submission_id')->constrained('intake_submissions')->restrictOnDelete();$t->foreignId('created_by')->constrained('users')->restrictOnDelete();$t->text('note');$t->timestamp('due_at')->nullable();$t->timestamp('completed_at')->nullable();$t->timestamps();});
        Schema::create('intake_control_audits',function(Blueprint $t){$t->id();$t->foreignId('actor_id')->constrained('users')->restrictOnDelete();$t->foreignId('exhibition_id')->constrained()->restrictOnDelete();$t->string('action',80);$t->json('configuration');$t->timestamp('created_at');});
    }
    public function down(): void
    {
        foreach(['intake_control_audits','intake_activities','intake_history','intake_inbox','intake_submissions','buyer_organizations','registration_controls','intake_nonces'] as $table){Schema::dropIfExists($table);}
    }
};
