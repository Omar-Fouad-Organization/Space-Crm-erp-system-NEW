<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sponsor_deliverables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deal_id')->constrained()->restrictOnDelete();
            $table->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('assigned_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('document_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('title', 200);
            $table->text('description');
            $table->string('category', 80)->nullable();
            $table->date('due_date')->nullable();
            $table->boolean('required');
            $table->string('status', 32);
            $table->unsignedInteger('version');
            $table->foreignId('approved_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->index(['deal_id', 'status', 'due_date']);
        });
        Schema::create('sponsor_deliverable_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deliverable_id')->constrained('sponsor_deliverables')->restrictOnDelete();
            $table->foreignId('deal_id')->constrained()->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->uuid('request_id');
            $table->unsignedInteger('version');
            $table->string('action', 32);
            $table->string('status', 32);
            $table->text('details');
            $table->timestamp('created_at');
            $table->unique(['deal_id', 'actor_id', 'request_id'], 'sponsor_delivery_receipt');
            $table->unique(['deliverable_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sponsor_deliverable_events');
        Schema::dropIfExists('sponsor_deliverables');
    }
};
