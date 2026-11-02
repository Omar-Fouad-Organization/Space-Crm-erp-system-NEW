<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB, Storage};
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AttachmentAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public static function scopes(): array
    {
        return [['own'], ['team']];
    }

    private function document(User $owner): int
    {
        $client = DB::table('clients')->insertGetId([
            'name' => 'Synthetic attachment client', 'contact_person' => 'Test',
            'email' => 'attachment@example.test', 'type' => 'exhibitor',
            'status' => 'prospect', 'created_by' => $owner->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return DB::table('documents')->insertGetId([
            'name' => 'Synthetic document', 'client_id' => $client,
            'type' => 'other', 'status' => 'draft', 'created_by' => $owner->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    #[DataProvider('scopes')]
    public function test_scoped_writers_cannot_access_another_owners_attachment(string $scope): void
    {
        Storage::fake('local');
        $team = DB::table('teams')->insertGetId(['name' => 'Attachment test team']);
        $owner = User::factory()->create(['role' => 'sales', 'status' => 'active']);
        $outsider = User::factory()->create([
            'role' => 'sales', 'status' => 'active', 'record_scope' => $scope, 'team_id' => $team,
        ]);
        $document = $this->document($owner);
        $this->actingAs($owner);
        $id = $this->post('/api/documents/'.$document.'/attachments', [
            'file' => UploadedFile::fake()->createWithContent('test.txt', 'Synthetic private attachment'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
        $path = DB::table('attachments')->where('id', $id)->value('path');
        $audit = DB::table('audit_logs')->count();

        $this->actingAs($outsider);
        $this->getJson('/api/attachments/'.$id)->assertNotFound();
        $this->deleteJson('/api/attachments/'.$id)->assertNotFound();
        $this->post('/api/documents/'.$document.'/attachments', [
            'file' => UploadedFile::fake()->createWithContent('blocked.txt', 'Blocked'),
        ], ['Accept' => 'application/json'])->assertNotFound();
        $this->assertDatabaseHas('attachments', ['id' => $id, 'document_id' => $document]);
        Storage::disk('local')->assertExists($path);
        $this->assertSame($audit, DB::table('audit_logs')->count());

        // Team access must include peers, while own access includes only the owner.
        if ($scope === 'team') {
            $owner->forceFill(['team_id' => $team])->save();
        } else {
            $owner->forceFill(['record_scope' => 'own'])->save();
            $this->actingAs($owner);
        }
        $this->get('/api/attachments/'.$id)->assertOk()->assertDownload('test.txt');
        $this->deleteJson('/api/attachments/'.$id)->assertNoContent();
        $this->assertDatabaseMissing('attachments', ['id' => $id]);
        Storage::disk('local')->assertMissing($path);
        $this->getJson('/api/attachments/'.$id)->assertNotFound();
        $this->deleteJson('/api/attachments/'.$id)->assertNotFound();
    }

    public function test_module_permission_is_required_even_for_the_document_owner(): void
    {
        $owner = User::factory()->create(['role' => 'hr', 'status' => 'active']);
        $document = $this->document($owner);
        $this->actingAs($owner);
        $this->deleteJson('/api/attachments/999999')->assertForbidden();
        $this->getJson('/api/attachments/999999')->assertForbidden();
        $this->post('/api/documents/'.$document.'/attachments', [], ['Accept' => 'application/json'])
            ->assertForbidden();
    }
}
