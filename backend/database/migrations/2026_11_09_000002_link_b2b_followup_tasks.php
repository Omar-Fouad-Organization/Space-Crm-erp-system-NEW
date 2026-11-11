<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('b2b_followup_tasks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('meeting_id')->unique()->constrained('b2b_meetings')->restrictOnDelete();
            $t->foreignId('task_id')->unique()->constrained('tasks')->restrictOnDelete();
            $t->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $t->foreignId('linked_by')->constrained('users')->restrictOnDelete();
            $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('b2b_followup_tasks');
    }
};
