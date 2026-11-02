<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function actingAs(\Illuminate\Contracts\Auth\Authenticatable $user, $guard = null)
    {
        $this->withSession([\App\Services\SessionRevocation::STAMP => [
            'user_id' => (int) $user->getAuthIdentifier(), 'version' => (int) $user->auth_version,
        ]]);
        return parent::actingAs($user, $guard);
    }

    public function createApplication()
    {
        $app = parent::createApplication();
        if (!$app->environment('testing') || config('database.default') !== 'mysql' || config('database.connections.mysql.database') !== 'space_crm_test') {
            throw new \RuntimeException('Refusing test setup outside the dedicated space_crm_test MySQL database.');
        }
        return $app;
    }
}
