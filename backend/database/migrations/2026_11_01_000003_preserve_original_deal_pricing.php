<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        foreach (['base_price','discount_percentage','tax_percentage'] as $field) {
            if (!Schema::hasColumn('deals',$field)) Schema::table('deals',fn(Blueprint $t)=>$t->decimal($field,15,2)->nullable());
        }
    }
    public function down(): void {
        Schema::table('deals',fn(Blueprint $t)=>$t->dropColumn(['base_price','discount_percentage','tax_percentage']));
    }
};
