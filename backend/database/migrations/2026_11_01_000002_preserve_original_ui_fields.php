<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        foreach (array_keys(config('crm.resources')) as $resource) Schema::table($resource,fn(Blueprint $t)=>$t->json('attributes')->nullable());
    }
    public function down(): void {
        foreach (array_keys(config('crm.resources')) as $resource) Schema::table($resource,fn(Blueprint $t)=>$t->dropColumn('attributes'));
    }
};
