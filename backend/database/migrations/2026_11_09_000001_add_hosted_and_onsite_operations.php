<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('b2b_hosted_participations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('participant_id')->unique()->constrained('b2b_participants')->restrictOnDelete();
            $t->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $t->string('status',20)->default('candidate');
            $t->unsignedInteger('version')->default(1);
            $t->foreignId('decided_by')->constrained('users')->restrictOnDelete();
            $t->dateTime('decided_at');
            $t->text('reason');
            $t->timestamps();
        });
        Schema::create('b2b_hosted_benefits', function (Blueprint $t) {
            $t->id();
            $t->foreignId('hosted_id')->constrained('b2b_hosted_participations')->restrictOnDelete();
            $t->string('classification',100);
            $t->string('status',20)->default('approved');
            $t->foreignId('approved_by')->constrained('users')->restrictOnDelete();
            $t->text('reason');
            $t->uuid('request_id')->unique();
            $t->timestamps();
        });
        Schema::create('b2b_arrivals', function (Blueprint $t) {
            $t->id();
            $t->foreignId('participant_id')->unique()->constrained('b2b_participants')->restrictOnDelete();
            $t->string('source',30)->default('staff_manual');
            $t->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $t->dateTime('recorded_at');
            $t->text('notes');
        });
        Schema::table('b2b_meetings', function (Blueprint $t) {
            $t->unsignedInteger('booking_revision')->default(1);
            $t->dateTime('started_at')->nullable();
            $t->dateTime('completed_at')->nullable();
            $t->string('outcome_code',40)->nullable();
            $t->boolean('outcome_published')->default(false);
        });
        Schema::create('b2b_meeting_attendance', function (Blueprint $t) {
            $t->id();
            $t->foreignId('meeting_id')->constrained('b2b_meetings')->restrictOnDelete();
            $t->unsignedInteger('booking_revision');
            $t->foreignId('participant_id')->constrained('b2b_participants')->restrictOnDelete();
            $t->string('status',20);
            $t->string('source',30)->default('staff_manual');
            $t->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $t->dateTime('recorded_at');
            $t->text('notes');
            $t->unique(['meeting_id','booking_revision','participant_id'],'b2b_attendance_once_per_booking');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('b2b_meeting_attendance');
        Schema::table('b2b_meetings', fn (Blueprint $t) => $t->dropColumn(['booking_revision','started_at','completed_at','outcome_code','outcome_published']));
        Schema::dropIfExists('b2b_arrivals');
        Schema::dropIfExists('b2b_hosted_benefits');
        Schema::dropIfExists('b2b_hosted_participations');
    }
};
