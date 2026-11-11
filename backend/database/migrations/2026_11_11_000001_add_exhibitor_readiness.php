<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('readiness_requirements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $table->string('title_en');
            $table->string('title_ar')->nullable();
            $table->text('description_en')->nullable();
            $table->text('description_ar')->nullable();
            $table->string('type', 32);
            $table->boolean('required');
            $table->date('due_date')->nullable();
            $table->unsignedInteger('display_order');
            $table->boolean('active');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
        });
        Schema::create('readiness_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requirement_id')->constrained('readiness_requirements')->restrictOnDelete();
            $table->foreignId('deal_id')->constrained()->restrictOnDelete();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('booth_id')->constrained()->restrictOnDelete();
            $table->string('status', 32);
            $table->unsignedInteger('version');
            $table->text('response')->nullable();
            $table->text('feedback')->nullable();
            $table->timestamps();
            $table->unique(['requirement_id', 'deal_id']);
        });
        Schema::create('readiness_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('result_id')->constrained('readiness_results')->restrictOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->uuid('membership_id')->nullable();
            $table->unsignedInteger('version');
            $table->string('previous_status', 32);
            $table->string('status', 32);
            $table->text('details');
            $table->timestamp('created_at');
            $table->unique(['result_id', 'version']);
        });
        Schema::create('readiness_handovers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deal_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('booth_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('employee_id')->constrained('users')->restrictOnDelete();
            $table->text('note')->nullable();
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['readiness_handovers', 'readiness_history', 'readiness_results', 'readiness_requirements'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
