<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_protected_route_requires_token(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_invalid_token_is_rejected(): void
    {
        $this->withHeaders(['Authorization' => 'Bearer invalid_token'])
            ->getJson('/api/me')
            ->assertStatus(401);
    }

    public function test_login_with_correct_password_returns_token(): void
    {
        $this->makeUser('admin', ['email' => 'a@jali.rw', 'password' => bcrypt('secret-pass')]);

        $this->postJson('/api/auth/login', ['email' => 'a@jali.rw', 'password' => 'secret-pass'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'roles', 'permissions']])
            ->assertJsonPath('user.roles', 'admin');
    }

    public function test_login_with_wrong_password_is_rejected(): void
    {
        $this->makeUser('admin', ['email' => 'a@jali.rw', 'password' => bcrypt('secret-pass')]);

        $this->postJson('/api/auth/login', ['email' => 'a@jali.rw', 'password' => 'nope'])
            ->assertStatus(401)
            ->assertJsonMissingPath('token');
    }

    public function test_login_to_passwordless_account_is_rejected(): void
    {
        // e.g. a Google sign-up or a pre-provisioned admin with no password yet
        $this->makeUser('superadmin', ['email' => 'g@jali.rw', 'password' => null]);

        $this->postJson('/api/auth/login', ['email' => 'g@jali.rw', 'password' => 'anything'])
            ->assertStatus(401)
            ->assertJsonMissingPath('token');
    }

    public function test_login_with_unknown_email_is_rejected(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'nobody@jali.rw', 'password' => 'x'])
            ->assertStatus(401);
    }

    public function test_me_returns_role_and_permissions(): void
    {
        $this->actingAsRole('driver');

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('roles', 'driver')
            ->assertJsonFragment(['create-private-seats']);
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = $this->makeUser('user');
        $token = $user->createToken('api-token')->plainTextToken;

        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
