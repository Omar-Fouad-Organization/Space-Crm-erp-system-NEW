<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('b2b_programs', function (Blueprint $t) {
            $t->id(); $t->foreignId('exhibition_id')->unique()->constrained()->restrictOnDelete();
            $t->string('timezone')->default('Africa/Cairo'); $t->boolean('dates_approved')->default(false);
            $t->json('meeting_dates'); $t->json('weights'); $t->json('bands'); $t->unsignedInteger('duration')->default(30);
            $t->unsignedInteger('version')->default(1); $t->timestamps();
        });
        Schema::create('b2b_categories', function (Blueprint $t) {
            $t->id(); $t->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $t->string('code',80); $t->string('name_en'); $t->string('name_ar'); $t->boolean('active')->default(true);
            $t->unique(['exhibition_id','code']); $t->timestamps();
        });
        Schema::create('b2b_participants', function (Blueprint $t) {
            $t->id(); $t->foreignId('exhibition_id')->constrained()->restrictOnDelete(); $t->string('kind',20);
            $t->foreignId('client_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('deal_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('intake_submission_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('buyer_organization_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->foreignId('assigned_user_id')->constrained('users')->restrictOnDelete();
            $t->text('profile'); $t->text('consent_evidence'); $t->text('commercial_evidence')->nullable();
            $t->string('status',30)->default('active'); $t->string('qualification',30)->default('standard');
            $t->unsignedInteger('profile_version')->default(1); $t->unsignedInteger('version')->default(1);
            $t->unsignedInteger('approved_profile_version')->nullable(); $t->timestamps();
            $t->unique(['exhibition_id','client_id']); $t->unique(['exhibition_id','intake_submission_id']);
            $t->unique(['exhibition_id','buyer_organization_id']);
        });
        Schema::create('b2b_qualifications', function (Blueprint $t) {
            $t->id(); $t->foreignId('participant_id')->constrained('b2b_participants')->restrictOnDelete();
            $t->unsignedInteger('profile_version'); $t->json('scores'); $t->text('evidence'); $t->unsignedInteger('total');
            $t->string('recommendation',40); $t->foreignId('reviewed_by')->constrained('users')->restrictOnDelete();
            $t->string('decision',20)->default('pending'); $t->foreignId('approved_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->text('reason')->nullable(); $t->timestamps();
        });
        Schema::create('b2b_concierge', function (Blueprint $t) {
            $t->id(); $t->foreignId('participant_id')->unique()->constrained('b2b_participants')->restrictOnDelete();
            $t->boolean('active'); $t->text('evidence'); $t->foreignId('coordinator_id')->constrained('users')->restrictOnDelete(); $t->timestamps();
        });
        Schema::create('b2b_people', function (Blueprint $t) {
            $t->id(); $t->text('name'); $t->foreignId('created_by')->constrained('users')->restrictOnDelete(); $t->timestamps();
        });
        Schema::create('b2b_representatives', function (Blueprint $t) {
            $t->id(); $t->foreignId('participant_id')->constrained('b2b_participants')->restrictOnDelete();
            $t->foreignId('person_id')->constrained('b2b_people')->restrictOnDelete(); $t->text('evidence');
            $t->boolean('active')->default(true); $t->unique(['participant_id','person_id']); $t->timestamps();
        });
        Schema::create('b2b_locations', function (Blueprint $t) {
            $t->id(); $t->foreignId('exhibition_id')->constrained()->restrictOnDelete(); $t->string('name'); $t->timestamps();
        });
        Schema::create('b2b_windows', function (Blueprint $t) {
            $t->id(); $t->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $t->foreignId('person_id')->nullable()->constrained('b2b_people')->restrictOnDelete();
            $t->foreignId('location_id')->nullable()->constrained('b2b_locations')->restrictOnDelete();
            $t->boolean('available'); $t->dateTime('starts_at'); $t->dateTime('ends_at'); $t->timestamps();
            $t->index(['exhibition_id','person_id','starts_at']); $t->index(['exhibition_id','location_id','starts_at']);
        });
        Schema::create('b2b_matches', function (Blueprint $t) {
            $t->id(); $t->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $t->foreignId('buyer_id')->constrained('b2b_participants')->restrictOnDelete();
            $t->foreignId('exhibitor_id')->constrained('b2b_participants')->restrictOnDelete();
            $t->unsignedInteger('buyer_version'); $t->unsignedInteger('exhibitor_version');
            $t->unsignedInteger('score'); $t->json('explanation'); $t->string('rule_version')->default('1');
            $t->string('status',40)->default('suggested'); $t->unsignedInteger('version')->default(1); $t->timestamps();
            $t->unique(['exhibition_id','buyer_id','exhibitor_id']);
        });
        Schema::create('b2b_invitations', function (Blueprint $t) {
            $t->id(); $t->foreignId('match_id')->constrained('b2b_matches')->restrictOnDelete(); $t->string('party',20);
            $t->string('status',20)->default('pending'); $t->string('communication_status',20)->default('not_sent');
            $t->dateTime('expires_at'); $t->text('evidence')->nullable(); $t->string('channel',40)->nullable();
            $t->foreignId('recorded_by')->nullable()->constrained('users')->restrictOnDelete(); $t->timestamps();
            $t->unique(['match_id','party']);
        });
        Schema::create('b2b_meetings', function (Blueprint $t) {
            $t->id(); $t->foreignId('match_id')->unique()->constrained('b2b_matches')->restrictOnDelete();
            $t->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $t->foreignId('buyer_representative_id')->constrained('b2b_representatives')->restrictOnDelete();
            $t->foreignId('exhibitor_representative_id')->constrained('b2b_representatives')->restrictOnDelete();
            $t->foreignId('location_id')->constrained('b2b_locations')->restrictOnDelete();
            $t->dateTime('starts_at'); $t->dateTime('ends_at'); $t->string('status',30)->default('scheduled');
            $t->unsignedInteger('version')->default(1); $t->text('result')->nullable();
            $t->foreignId('followup_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->date('followup_due')->nullable(); $t->string('followup_status',20)->nullable(); $t->timestamps();
        });
        Schema::create('b2b_slots', function (Blueprint $t) {
            $t->id(); $t->foreignId('meeting_id')->constrained('b2b_meetings')->restrictOnDelete();
            $t->string('resource_type',20); $t->unsignedBigInteger('resource_id'); $t->dateTime('starts_at');
            $t->unique(['resource_type','resource_id','starts_at'],'b2b_slot_exclusion');
        });
        Schema::create('b2b_audits', function (Blueprint $t) {
            $t->id(); $t->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $t->string('resource'); $t->unsignedBigInteger('record_id'); $t->string('action'); $t->text('details'); $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['b2b_audits','b2b_slots','b2b_meetings','b2b_invitations','b2b_matches','b2b_windows','b2b_locations','b2b_representatives','b2b_people','b2b_concierge','b2b_qualifications','b2b_participants','b2b_categories','b2b_programs'] as $table) Schema::dropIfExists($table);
    }
};
