<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('auth_version')->default(0);
        });
        Schema::create('revoked_staff_sessions', function (Blueprint $table) {
            $table->string('session_hash', 64)->primary();
            $table->timestamp('expires_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revoked_staff_sessions');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('auth_version');
        });
    }
};
