<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\SessionRevocation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\{ConnectionException, Request};
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB, Http};
use Tests\TestCase;

class WebsiteCmsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $marketing;
    private int $event;
    private const KEY = 'SyntheticCmsGatewayKeyOnlyForTests000000000000000000';

    protected function setUp(): void
    {
        parent::setUp();
        config(['authorization.enabled'=>true,'cms_gateway.enabled'=>true,'cms_gateway.key'=>self::KEY]);
        $this->admin = User::factory()->create(['role'=>'super_admin','status'=>'active']);
        $this->marketing = User::factory()->create(['role'=>'support','status'=>'active','authorization_scoped'=>true,'record_scope'=>'own']);
        $this->event = DB::table('exhibitions')->insertGetId(['name'=>'Synthetic CMS exhibition','start_date'=>'2027-01-01','end_date'=>'2027-01-03',
            'location'=>'Synthetic','currency'=>'EGP','status'=>'planning','created_by'=>$this->admin->id]);
        DB::table('exhibition_user')->insert(['user_id'=>$this->marketing->id,'exhibition_id'=>$this->event,'granted_by'=>$this->admin->id]);
        config(['cms_gateway.sites.green-life-expo.exhibition_id'=>$this->event,
            'cms_gateway.sites.green-life-expo.gateway_url'=>'https://cms.example.test/api/internal/cms',
            'cms_gateway.sites.green-life-expo.public_origin'=>'https://public.example.test']);
        $this->actingAs($this->admin);
        Http::preventStrayRequests();
    }

    private function grant(array $permissions): void
    {
        foreach (array_keys(app(\App\Services\PermissionPolicy::class)->registry()) as $key) {
            DB::table('user_permission_overrides')->updateOrInsert(['user_id'=>$this->marketing->id,'permission'=>$key],
                ['allowed'=>in_array($key,$permissions,true),'granted_by'=>$this->admin->id]);
        }
        app(SessionRevocation::class)->revoke($this->marketing->id);
        $this->marketing->refresh();
        $this->actingAs($this->marketing);
    }

    private function claims(Request $request): array
    {
        return json_decode(base64_decode(strtr($request->header('X-Space-Delegation')[0], '-_', '+/')), true, 512, JSON_THROW_ON_ERROR);
    }

    private function fake(array $rows = []): void
    {
        Http::fake(function (Request $request) use ($rows) {
            $claims = $this->claims($request);
            return Http::response(['data'=>$rows,'count'=>count($rows),'correlation_id'=>$claims['correlation_id']],200);
        });
    }

    private function endpoint(string $resource = 'blogs'): string
    {
        return '/api/website-cms/green-life-expo/resources/'.$resource;
    }

    public function test_the_feature_flag_cannot_be_bypassed_even_by_super_admin(): void
    {
        config(['authorization.enabled'=>false]);
        $this->getJson('/api/website-cms/sites')->assertForbidden();
        config(['authorization.enabled'=>true,'cms_gateway.enabled'=>false]);
        $this->postJson($this->endpoint(),['operation'=>'list','expected_version'=>null])->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_marketing_can_view_and_edit_drafts_without_crm_finance_or_staff_authority(): void
    {
        $this->grant(['website.view','blogs.view','blogs.edit']);
        $this->getJson('/api/website-cms/sites')->assertOk()->assertJsonCount(1,'data')->assertJsonMissingPath('data.0.gateway_url')->assertJsonMissingPath('data.0.key');
        $this->getJson('/api/records/deals')->assertForbidden();
        $this->getJson('/api/workspace/finance')->assertForbidden();
        $this->getJson('/api/records/users')->assertForbidden();
        $this->fake([['id'=>'01900000-0000-7000-8000-000000000001','is_published'=>false,'_version'=>str_repeat('a',64)]]);
        $this->postJson($this->endpoint(),['operation'=>'update','filters'=>[['column'=>'id','operator'=>'eq','value'=>'01900000-0000-7000-8000-000000000001']],
            'records'=>['title'=>'Synthetic draft change'],'expected_version'=>str_repeat('a',64)])->assertOk();
        Http::assertSentCount(2);
        Http::assertSent(function (Request $request): bool {
            $claims = $this->claims($request);
            $encoded = $request->header('X-Space-Delegation')[0];
            $this->assertSame(hash_hmac('sha256',$encoded,self::KEY),$request->header('X-Space-Signature')[0]);
            $this->assertSame(hash('sha256',$request->body()),$claims['body_sha256']);
            $this->assertSame('erp:'.$this->marketing->id,$claims['actor']);
            $this->assertSame($this->event,$claims['exhibition_id']);
            $this->assertNotContains('blogs.publish',$claims['permissions']);
            $this->assertFalse($request->hasHeader('Cookie'));
            return true;
        });
    }

    public function test_missing_event_membership_or_unknown_site_is_hidden_before_forwarding(): void
    {
        $this->grant(['website.view','blogs.view']);
        DB::table('exhibition_user')->where('user_id',$this->marketing->id)->delete();
        app(SessionRevocation::class)->revoke($this->marketing->id);$this->marketing->refresh();$this->actingAs($this->marketing);
        $this->getJson('/api/website-cms/sites')->assertOk()->assertJsonCount(0,'data');
        $this->postJson($this->endpoint(),['operation'=>'list','expected_version'=>null])->assertNotFound();
        $this->postJson('/api/website-cms/another-site/resources/blogs',['operation'=>'list','expected_version'=>null])->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_edit_denials_and_unknown_resources_fields_or_arbitrary_urls_are_not_forwarded(): void
    {
        $this->grant(['website.view','blogs.view']);
        $input = ['operation'=>'update','filters'=>[['column'=>'id','operator'=>'eq','value'=>'01900000-0000-7000-8000-000000000001']],
            'records'=>['title'=>'Crafted'],'expected_version'=>str_repeat('a',64)];
        $this->postJson($this->endpoint(),$input)->assertForbidden();
        $this->postJson($this->endpoint('payments'),['operation'=>'list','expected_version'=>null])->assertNotFound();
        $this->postJson($this->endpoint(),['operation'=>'list','expected_version'=>null,'url'=>'http://169.254.169.254/'])->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_live_blog_and_live_settings_require_publication_permission_before_mutation(): void
    {
        $this->grant(['website.view','blogs.view','blogs.edit','settings.view','settings.edit']);
        $this->fake([['id'=>'01900000-0000-7000-8000-000000000001','is_published'=>true,'_version'=>str_repeat('a',64)]]);
        $this->postJson($this->endpoint(),['operation'=>'update','filters'=>[['column'=>'id','operator'=>'eq','value'=>'01900000-0000-7000-8000-000000000001']],
            'records'=>['title'=>'Live change'],'expected_version'=>str_repeat('a',64)])->assertForbidden();
        Http::assertSentCount(1);
        $this->postJson($this->endpoint('settings'),['operation'=>'update','filters'=>[['column'=>'setting_key','operator'=>'eq','value'=>'site_title']],
            'records'=>['setting_value'=>'Live change'],'expected_version'=>str_repeat('a',64)])->assertForbidden();
        Http::assertSentCount(1);
    }

    public function test_upstream_auth_failures_do_not_log_out_staff_or_leak_service_details(): void
    {
        Http::fake(fn()=>Http::response(['message'=>'Synthetic sensitive upstream detail'],401));
        $this->postJson($this->endpoint(),['operation'=>'list','expected_version'=>null])->assertStatus(502)->assertDontSee('Synthetic sensitive upstream detail');
        $this->getJson('/api/metadata')->assertOk();
        $audit=DB::table('audit_logs')->where('resource','website_cms')->first();
        $this->assertNotNull($audit);
        $this->assertStringNotContainsString(self::KEY,$audit->after);
        $this->assertStringNotContainsString('X-Space-Signature',$audit->after);
    }

    public function test_read_outage_retries_are_bounded_and_writes_are_not_retried(): void
    {
        $attempts=0;
        Http::fake(function () use (&$attempts) { $attempts++; throw new ConnectionException('Synthetic unavailable service'); });
        $this->postJson($this->endpoint(),['operation'=>'list','expected_version'=>null])->assertStatus(502);
        $this->assertSame(2,$attempts);
        $attempts=0;
        $this->postJson($this->endpoint(),['operation'=>'create','records'=>['title'=>'Draft','slug'=>'draft','content'=>'Synthetic','is_published'=>false],'expected_version'=>null])->assertStatus(502);
        $this->assertSame(1,$attempts);
    }

    public function test_uploads_use_a_bound_server_stream_and_never_forward_browser_credentials(): void
    {
        $captured=false;
        Http::fake(function (Request $request) use (&$captured) {
            $claims=$this->claims($request);
            $this->assertSame(hash('sha256',$request->body()),$claims['body_sha256']);
            $this->assertSame('/api/internal/cms/green-life-expo/upload?bucket=premium_photos',$claims['target']);
            $this->assertFalse($request->hasHeader('Cookie'));
            $captured=true;
            return Http::response(['data'=>['url'=>'/storage/premium_photos/synthetic.png'],'correlation_id'=>$claims['correlation_id']]);
        });
        $file=UploadedFile::fake()->createWithContent('synthetic.png',base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII='));
        $this->post('/api/website-cms/green-life-expo/uploads',['file'=>$file,'bucket'=>'premium_photos'],['Accept'=>'application/json'])->assertOk();
        $this->assertTrue($captured);
    }

    public function test_service_response_size_is_bounded(): void
    {
        config(['cms_gateway.max_response_bytes'=>100]);
        $this->fake([['content'=>str_repeat('x',200)]]);
        $this->postJson($this->endpoint(),['operation'=>'list','expected_version'=>null])->assertStatus(502);
    }
}
