<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('portal_access_invitations', function (Blueprint $table): void {
            $table->string('proof_channel', 24)->nullable();
            $table->string('status', 24)->nullable();
            $table->string('locale', 2)->nullable();
            $table->unsignedInteger('generation')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('redeemed_at')->nullable();
            $table->uuid('supersedes_id')->nullable()->index();
            $table->uuid('regrant_membership_id')->nullable();
            $table->string('regrant_revocation_hash', 64)->nullable();
        });
        Schema::create('portal_invitation_deliveries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('invitation_id');
            $table->foreign('invitation_id')->references('id')->on('portal_access_invitations')->restrictOnDelete();
            $table->unsignedInteger('generation');
            $table->string('state', 32)->default('pending');
            $table->string('key_id', 24);
            $table->longText('secret_payload')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('next_attempt_at')->nullable();
            $table->timestamp('lease_until')->nullable();
            $table->timestamp('attempted_at')->nullable();
            $table->string('provider_reference', 255)->nullable();
            $table->string('failure_code', 64)->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->unique(['invitation_id', 'generation'], 'portal_invite_delivery_generation');
            $table->index(['state', 'next_attempt_at'], 'portal_invite_delivery_due');
        });
        Schema::create('portal_invitation_events', function (Blueprint $table): void {
            $table->id();
            $table->uuid('invitation_id')->index();
            $table->uuid('delivery_id')->nullable();
            $table->foreignId('employee_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('event', 48);
            $table->text('details')->nullable();
            $table->timestamp('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('portal_invitation_events');
        Schema::dropIfExists('portal_invitation_deliveries');
        Schema::table('portal_access_invitations', function (Blueprint $table): void {
            $table->dropColumn(['proof_channel', 'status', 'locale', 'generation', 'issued_at', 'redeemed_at', 'supersedes_id', 'regrant_membership_id', 'regrant_revocation_hash']);
        });
    }
};
