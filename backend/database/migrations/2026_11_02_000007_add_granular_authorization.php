<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('authorization_scoped')->default(false);
            $table->boolean('all_exhibitions')->default(false);
        });
        Schema::create('user_permission_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('permission', 100);
            $table->boolean('allowed');
            $table->foreignId('granted_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'permission']);
        });
        Schema::create('exhibition_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exhibition_id')->constrained()->restrictOnDelete();
            $table->foreignId('granted_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'exhibition_id']);
            $table->index(['exhibition_id', 'user_id']);
        });
        // Fixed historical shape: do not generate migrations from mutable resource config.
        foreach (['tasks', 'meetings', 'documents', 'tickets', 'channels'] as $resource) {
            Schema::table($resource, function (Blueprint $table) {
                $table->foreignId('exhibition_id')->nullable()->constrained()->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach (['tasks', 'meetings', 'documents', 'tickets', 'channels'] as $resource) {
            Schema::table($resource, fn (Blueprint $table) => $table->dropConstrainedForeignId('exhibition_id'));
        }
        Schema::dropIfExists('exhibition_user');
        Schema::dropIfExists('user_permission_overrides');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['authorization_scoped', 'all_exhibitions']));
    }
};
