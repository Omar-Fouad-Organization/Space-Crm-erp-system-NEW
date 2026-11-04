<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('b2b_windows', function (Blueprint $t) {
            $t->boolean('active')->default(true); $t->unsignedInteger('version')->default(1);
        });
    }
    public function down(): void
    {
        Schema::table('b2b_windows', fn (Blueprint $t) => $t->dropColumn(['active','version']));
    }
};
