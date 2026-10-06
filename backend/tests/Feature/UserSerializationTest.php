<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserSerializationTest extends TestCase
{
    use RefreshDatabase;

    public function test_secrets_are_never_serialised(): void
    {
        $user = $this->makeUser('user', ['fcm_token' => 'device-token']);

        $json = $user->toArray();

        $this->assertArrayNotHasKey('password', $json);
        $this->assertArrayNotHasKey('fcm_token', $json);
    }

    public function test_admin_user_list_does_not_leak_password_hashes(): void
    {
        $this->makeUser('user', ['password' => 'plain-secret']);
        $this->actingAsRole('superadmin');

        $body = $this->getJson('/api/admin/users')->assertOk()->getContent();

        $this->assertStringNotContainsString('$2y$', $body);
        $this->assertStringNotContainsString('"password"', $body);
    }

    public function test_plain_password_is_hashed_on_save(): void
    {
        $user = $this->makeUser('user', ['password' => 'plain-secret']);

        $this->assertNotSame('plain-secret', $user->getRawOriginal('password'));
    }
}
