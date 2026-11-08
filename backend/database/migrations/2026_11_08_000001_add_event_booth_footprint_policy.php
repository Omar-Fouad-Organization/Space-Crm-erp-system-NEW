<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The original CRM migration builds columns from the current resource config.
        // Fresh installations already have these two fields; upgrades do not.
        foreach (['footprint_width_m', 'footprint_depth_m'] as $column) {
            if (! Schema::hasColumn('booths', $column)) {
                Schema::table('booths', fn (Blueprint $table) => $table->decimal($column, 15, 2)->nullable());
            }
        }
        Schema::table('booths', function (Blueprint $table): void {
            $table->string('footprint_policy_version', 40)->nullable();
        });
        Schema::create('exhibition_booth_policies', function (Blueprint $table): void {
            $table->foreignId('exhibition_id')->primary()->constrained('exhibitions')->restrictOnDelete();
            $table->string('code', 40);
            $table->unsignedBigInteger('legacy_max_booth_id');
            $table->foreignId('reviewed_by')->constrained('users')->restrictOnDelete();
            $table->text('approval_evidence');
            $table->timestamp('activated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exhibition_booth_policies');
        Schema::table('booths', fn (Blueprint $table) => $table->dropColumn(['footprint_width_m', 'footprint_depth_m', 'footprint_policy_version']));
    }
};
