<?php

namespace Tests\Feature;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class DependencyRequestSecurityTest extends TestCase
{
    public function test_untrusted_forwarded_headers_do_not_select_the_application_host_or_scheme(): void
    {
        Route::get('/__phase63/origin', fn (Request $request) => ['host' => $request->getHost(), 'scheme' => $request->getScheme()]);
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.25'])
            ->withHeaders(['X-Forwarded-Host' => 'untrusted.example.test', 'X-Forwarded-Proto' => 'https'])
            ->getJson('http://localhost/__phase63/origin')->assertOk()->assertExactJson(['host' => 'localhost', 'scheme' => 'http']);
    }

    public function test_a_script_name_prefix_does_not_alias_an_application_route(): void
    {
        Route::get('/__phase63/protected', fn () => ['route' => 'expected']);
        $this->getJson('/__phase63/protected')->assertOk();
        $this->withServerVariables(['SCRIPT_NAME' => '/index.php', 'PHP_SELF' => '/index.php__phase63/protected'])
            ->getJson('/index.php__phase63/protected')->assertNotFound();
    }
}
