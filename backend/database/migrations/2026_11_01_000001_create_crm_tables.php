<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('role')->default('operations');
            $t->string('status')->default('active');
        });
        // Create columns first, then constraints: resources may refer to later tables.
        foreach (config('crm.resources') as $resource => $config) {
            if ($resource === 'users') continue;
            Schema::create($resource, function (Blueprint $t) use ($resource, $config) {
                $t->id();
                foreach ($config['fields'] as $key => $field) {
                    $column = match ($field['type']) {
                        'relation' => $t->unsignedBigInteger($key),
                        'money', 'decimal' => $t->decimal($key, 15, 2),
                        'number' => $t->unsignedInteger($key),
                        'date' => $t->date($key),
                        'time' => $t->time($key),
                        'textarea' => $t->text($key),
                        default => $t->string($key),
                    };
                    if (!($field['required'] ?? false)) $column->nullable();
                    if (isset($field['default'])) $column->default($field['default']);
                    if ($field['type'] === 'relation') $column->index();
                }
                if ($resource === 'booths') $t->string('status')->default('available');
                $t->unsignedBigInteger('created_by')->index();
                $t->timestamps();
                if ($resource === 'booths') $t->unique(['exhibition_id', 'name']);
                if ($resource === 'employees') $t->unique('user_id');
                if (in_array($resource, ['payments', 'invoices'])) $t->unique('name');
                if ($resource === 'commissions') $t->unique('deal_id');
            });
        }
        foreach (config('crm.resources') as $resource => $config) {
            if ($resource === 'users') continue;
            Schema::table($resource, function (Blueprint $t) use ($config) {
                foreach ($config['fields'] as $key => $field) {
                    if ($field['type'] === 'relation') $t->foreign($key)->references('id')->on($field['resource'])->restrictOnDelete();
                }
                $t->foreign('created_by')->references('id')->on('users')->restrictOnDelete();
            });
        }
        Schema::create('meeting_attendees', function (Blueprint $t) {
            $t->id();
            $t->foreignId('meeting_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->unique(['meeting_id', 'user_id']);
        });
        Schema::create('attachments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('document_id')->constrained()->cascadeOnDelete();
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->string('name'); $t->string('path'); $t->string('mime'); $t->unsignedBigInteger('size'); $t->timestamps();
        });
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id(); $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->string('resource'); $t->unsignedBigInteger('record_id'); $t->string('action');
            $t->json('before')->nullable(); $t->json('after')->nullable(); $t->timestamps();
            $t->index(['resource', 'record_id']);
        });
        Schema::create('notifications', function (Blueprint $t) {
            $t->id(); $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('name'); $t->string('resource'); $t->unsignedBigInteger('record_id');
            $t->timestamp('read_at')->nullable(); $t->timestamps();
        });
        Schema::create('settings', function (Blueprint $t) {
            $t->id(); $t->string('company_name')->default('SPACE Organizing'); $t->string('currency')->default('EGP'); $t->timestamps();
        });
    }
    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        foreach (array_merge(['meeting_attendees', 'attachments', 'audit_logs', 'notifications', 'settings'], array_keys(config('crm.resources'))) as $table) {
            if ($table !== 'users') Schema::dropIfExists($table);
        }
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['role', 'status']));
        Schema::enableForeignKeyConstraints();
    }
};
