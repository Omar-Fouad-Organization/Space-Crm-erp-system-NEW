<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\{SessionRevocation, Totp};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Auth, DB, File, Hash, Password};
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SessionRevocationTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'SyntheticPassword!2026';
    private string $sessionDirectory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sessionDirectory = storage_path('framework/testing/security-'.bin2hex(random_bytes(8)));
        File::makeDirectory($this->sessionDirectory, 0755, true);
        config(['session.files' => $this->sessionDirectory, 'session.lottery' => [0, 100]]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->sessionDirectory);
        parent::tearDown();
    }

    public static function drivers(): array
    {
        return [['file'], ['database'], ['cookie']];
    }

    private function user(string $role = 'sales'): User
    {
        return User::factory()->create([
            'role' => $role, 'status' => 'active', 'password' => Hash::make(self::PASSWORD),
        ]);
    }

    /** Independent cookie jars and fresh guards/stores: no actingAs authentication shortcut. */
    private function browser(array &$cookies, string $method, string $uri, array $data = [], array $headers = [])
    {
        $this->app['auth']->forgetGuards();
        $this->app->forgetInstance('auth.driver');
        $this->app['session']->forgetDrivers();
        $this->app->forgetInstance('session.store');
        foreach ($this->app['cookie']->getQueuedCookies() as $queued) {
            $this->app['cookie']->unqueue($queued->getName(), $queued->getPath());
        }
        $this->unencryptedCookies = $cookies;
        $this->withCredentials = true;
        $response = $this->json($method, $uri, $data, $headers);
        foreach ($response->headers->getCookies() as $cookie) {
            if ($cookie->getExpiresTime() && $cookie->getExpiresTime() < time()) {
                unset($cookies[$cookie->getName()]);
            } else {
                $cookies[$cookie->getName()] = $cookie->getValue();
            }
        }
        return $response;
    }

    private function login(array &$cookies, User $user): void
    {
        $this->browser($cookies, 'POST', '/api/login', [
            'email' => $user->email, 'password' => self::PASSWORD,
        ])->assertOk()->assertJsonMissingPath('user.auth_version');
    }

    #[DataProvider('drivers')]
    public function test_other_sessions_are_revoked_but_current_and_unrelated_accounts_remain(string $driver): void
    {
        config(['session.driver' => $driver]);
        $user = $this->user(); $other = $this->user();
        $a = $b = $c = [];
        $this->login($a, $user); $this->login($b, $user); $this->login($c, $other);
        $this->browser($b, 'GET', '/api/metadata')->assertOk();
        $this->browser($a, 'POST', '/api/security/revoke', ['password' => 'wrong'])->assertUnprocessable();
        $this->browser($b, 'GET', '/api/session')->assertJsonPath('user.id', $user->id);
        $this->browser($a, 'POST', '/api/security/revoke', ['password' => self::PASSWORD])->assertOk();
        $this->browser($a, 'GET', '/api/metadata')->assertOk();
        $signedOut = $this->browser($b, 'GET', '/api/session');
        if ($signedOut->status() === 200) $signedOut->assertJsonPath('user', null);
        else $signedOut->assertUnauthorized();
        $this->browser($b, 'GET', '/api/metadata')->assertUnauthorized();
        $this->browser($c, 'GET', '/api/metadata')->assertOk();
        $this->assertSame(1, $user->fresh()->auth_version);
    }

    #[DataProvider('drivers')]
    public function test_logout_rejects_replayed_session_without_logging_out_another_browser(string $driver): void
    {
        config(['session.driver' => $driver]);
        $user = $this->user(); $a = $b = [];
        $this->login($a, $user); $this->login($b, $user);
        $replay = $a;
        $this->browser($a, 'POST', '/api/logout')->assertOk()->assertJsonPath('user', null);
        $this->browser($replay, 'GET', '/api/metadata')->assertUnauthorized();
        $this->browser($b, 'GET', '/api/metadata')->assertOk();
        $this->assertSame(0, $user->fresh()->auth_version);
    }

    public static function accountChanges(): array
    {
        $cases = [];
        foreach (['file', 'database', 'cookie'] as $driver) {
            foreach (['password', 'role', 'status', 'email', 'record_scope', 'team_id'] as $change) {
                $cases[$driver.'-'.$change] = [$driver, $change];
            }
        }
        return $cases;
    }

    #[DataProvider('accountChanges')]
    public function test_administrative_security_changes_invalidate_existing_sessions(string $driver, string $change): void
    {
        config(['session.driver' => $driver]);
        $admin = $this->user('super_admin'); $user = $this->user();
        $staff = $administrator = [];
        $this->login($staff, $user); $this->login($administrator, $admin);
        if (in_array($change, ['record_scope', 'team_id'])) {
            $team = DB::table('teams')->insertGetId(['name' => 'Synthetic security team']);
            $this->browser($administrator, 'PUT', '/api/workspace/access/'.$user->id, [
                'record_scope' => $change === 'team_id' ? 'team' : 'own',
                'team_id' => $change === 'team_id' ? $team : null,
            ])->assertOk();
        } else {
            $values = ['name' => $user->name, 'email' => $user->email, 'role' => 'sales', 'status' => 'active'];
            $values[$change] = match ($change) {
                'password' => 'ReplacementPassword!2026', 'role' => 'support',
                'status' => 'inactive', 'email' => 'updated@example.test',
            };
            $this->browser($administrator, 'PUT', '/api/records/users/'.$user->id, $values)->assertOk()
                ->assertJsonMissingPath('data.auth_version');
        }
        $this->assertSame(1, $user->fresh()->auth_version);
        $this->browser($staff, 'GET', '/api/metadata')->assertUnauthorized();
        $this->browser($administrator, 'GET', '/api/metadata')->assertOk();
        if ($change === 'status') {
            $this->browser($administrator, 'PUT', '/api/records/users/'.$user->id, [
                'name' => $user->name, 'email' => $user->email, 'role' => 'sales', 'status' => 'active',
            ])->assertOk();
            $this->browser($staff, 'GET', '/api/metadata')->assertUnauthorized();
        }
    }

    #[DataProvider('drivers')]
    public function test_password_reset_revokes_every_session_and_preserves_mfa(string $driver): void
    {
        config(['session.driver' => $driver]);
        $user = $this->user(); $a = $b = $anonymous = [];
        $this->login($a, $user); $this->login($b, $user);
        $secret = encrypt('SYNTHETICMFASECRET');
        $user->forceFill(['mfa_secret' => $secret, 'mfa_confirmed_at' => now()])->save();
        $token = Password::createToken($user);
        $payload = ['email' => $user->email, 'token' => $token,
            'password' => 'ReplacementPassword!2026', 'password_confirmation' => 'ReplacementPassword!2026'];
        $this->browser($anonymous, 'POST', '/api/password/reset', [...$payload, 'token' => 'wrong'])->assertUnprocessable();
        $this->assertSame(0, $user->fresh()->auth_version);
        $this->browser($anonymous, 'POST', '/api/password/reset', $payload)->assertOk();
        $this->browser($a, 'GET', '/api/metadata')->assertUnauthorized();
        $this->browser($b, 'GET', '/api/metadata')->assertUnauthorized();
        $this->assertSame($secret, $user->fresh()->mfa_secret);
        $this->browser($anonymous, 'POST', '/api/password/reset', $payload)->assertUnprocessable();
    }

    #[DataProvider('drivers')]
    public function test_mfa_changes_revoke_other_sessions_and_preserve_current(string $driver): void
    {
        config(['session.driver' => $driver]);
        $user = $this->user(); $a = $b = [];
        $this->login($a, $user); $this->login($b, $user);
        $secret = $this->browser($a, 'POST', '/api/security/enroll', ['password' => self::PASSWORD])
            ->assertOk()->json('secret');
        $counter = intdiv(time(), 30); $totp = new Totp();
        $this->browser($a, 'POST', '/api/security/confirm', ['code' => $totp->code($secret, $counter)])
            ->assertOk();
        $this->browser($a, 'GET', '/api/metadata')->assertOk();
        $this->browser($b, 'GET', '/api/metadata')->assertUnauthorized();
        $c = [];
        $this->browser($c, 'POST', '/api/login', ['email' => $user->email, 'password' => self::PASSWORD,
            'code' => $totp->code($secret, $counter + 1)])->assertOk();
        $this->browser($a, 'POST', '/api/security/disable', ['password' => self::PASSWORD,
            'code' => $totp->code($secret, $counter)])->assertUnprocessable();
        // Advance the clock used by the authenticator through its existing service contract.
        $mock = $this->mock(Totp::class);
        $mock->shouldReceive('verify')->once()->with($secret, '123456', $counter + 1)->andReturn($counter + 2);
        $this->browser($a, 'POST', '/api/security/disable', ['password' => self::PASSWORD, 'code' => '123456'])
            ->assertOk();
        $this->browser($a, 'GET', '/api/metadata')->assertOk();
        $this->browser($c, 'GET', '/api/metadata')->assertUnauthorized();
        $this->assertNull($user->fresh()->mfa_secret);
        $this->assertSame(2, $user->fresh()->auth_version);
    }

    public function test_legacy_or_forged_authentication_stamps_are_not_adopted(): void
    {
        $user = $this->user();
        foreach ([null, ['user_id' => $user->id + 1, 'version' => 0], ['user_id' => $user->id, 'version' => 99]] as $stamp) {
            $this->actingAs($user)->withSession([SessionRevocation::STAMP => $stamp]);
            $this->getJson('/api/session')->assertUnauthorized();
        }
    }

    #[DataProvider('drivers')]
    public function test_persisted_legacy_login_cannot_acquire_a_new_authentication_stamp(string $driver): void
    {
        config(['session.driver' => $driver]);
        $user = $this->user(); $cookies = [];
        // Test-only route reproduces the previous application's unstamped session issuance.
        \Illuminate\Support\Facades\Route::middleware('web')->post('/test/legacy-login', function () use ($user) {
            Auth::login($user);
            request()->session()->regenerate();
            return ['legacy' => true];
        });
        $this->browser($cookies, 'POST', '/test/legacy-login')->assertOk();
        $this->browser($cookies, 'GET', '/api/session')->assertUnauthorized();
        $this->browser($cookies, 'GET', '/api/metadata')->assertUnauthorized();
        $this->login($cookies, $user);
        $this->browser($cookies, 'GET', '/api/metadata')->assertOk();
    }

    public function test_csrf_remains_required_for_login_and_revocation(): void
    {
        config(['session.driver' => 'file']);
        $this->partialMock(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class, function ($mock) {
            $mock->shouldAllowMockingProtectedMethods()->shouldReceive('runningUnitTests')->andReturn(false);
        });
        $user = $this->user(); $cookies = [];
        $token = $this->browser($cookies, 'GET', '/api/session')->assertOk()->json('csrf_token');
        $login = ['email' => $user->email, 'password' => self::PASSWORD];
        $this->browser($cookies, 'POST', '/api/login', $login)->assertStatus(419);
        $token = $this->browser($cookies, 'POST', '/api/login', $login, ['X-CSRF-TOKEN' => $token])
            ->assertOk()->json('csrf_token');
        $this->browser($cookies, 'POST', '/api/security/revoke', ['password' => self::PASSWORD])->assertStatus(419);
        $this->assertSame(0, $user->fresh()->auth_version);
        $this->browser($cookies, 'POST', '/api/security/revoke', ['password' => self::PASSWORD], ['X-CSRF-TOKEN' => $token])
            ->assertOk();
        $this->browser($cookies, 'GET', '/api/session')->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_failed_administrator_change_rolls_back_revocation(): void
    {
        $admin = $this->user('super_admin');
        $this->actingAs($admin);
        $this->putJson('/api/records/users/'.$admin->id, [
            'name' => $admin->name, 'email' => $admin->email, 'role' => 'sales', 'status' => 'active',
        ])->assertUnprocessable();
        $this->assertSame(0, $admin->fresh()->auth_version);
        $this->getJson('/api/metadata')->assertOk();
    }
}
