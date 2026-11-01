<?php
namespace Tests\Feature;

use App\Models\User;
use App\Services\CrmService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PermissionMatrixTest extends TestCase
{
    use RefreshDatabase;
    public static function roles(): array { return array_map(fn($r)=>[$r],['super_admin','management','sales','finance','operations','hr','support']); }
    #[DataProvider('roles')]
    public function test_every_module_enforces_the_role_matrix(string $role): void
    {
        $this->assertSame('space_crm_test',DB::connection()->getDatabaseName());
        $user=User::factory()->create(['role'=>$role,'status'=>'active']); $this->actingAs($user);
        $metadata=$this->getJson('/api/metadata')->assertOk()->json('resources');
        foreach (array_keys(config('crm.resources')) as $resource) {
            $admin=$role==='super_admin'; $manager=$role==='management' && !in_array($resource,['users','employees']);
            $read=$admin || $manager || in_array($resource,CrmService::READ[$role] ?? []);
            $write=$admin || $manager || in_array($resource,CrmService::WRITE[$role] ?? []);
            $this->getJson('/api/records/'.$resource)->assertStatus($read ? 200 : 403);
            $this->postJson('/api/records/'.$resource,[])->assertStatus($write ? 422 : 403);
            if ($read) $this->assertSame($write,$metadata[$resource]['can_write']);
            else $this->assertArrayNotHasKey($resource,$metadata);
        }
    }
    public function test_references_have_actual_mysql_foreign_keys(): void
    {
        $constraints=DB::select("SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");
        $lookup=[]; foreach ($constraints as $c) $lookup[$c->TABLE_NAME.'.'.$c->COLUMN_NAME]=$c->REFERENCED_TABLE_NAME;
        foreach (config('crm.resources') as $resource=>$config) {
            foreach ($config['fields'] as $key=>$field) if ($field['type']==='relation') $this->assertSame($field['resource'],$lookup[$resource.'.'.$key] ?? null,$resource.'.'.$key);
        }
    }
}
