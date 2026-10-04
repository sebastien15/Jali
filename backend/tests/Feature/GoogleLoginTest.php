<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Kreait\Firebase\Contract\Auth as FirebaseAuth;
use Lcobucci\JWT\Token\DataSet;
use Lcobucci\JWT\UnencryptedToken;
use Mockery;
use Tests\TestCase;

class GoogleLoginTest extends TestCase
{
    use RefreshDatabase;

    private function fakeFirebase(array $claims): void
    {
        $token = Mockery::mock(UnencryptedToken::class);
        $token->shouldReceive('claims')->andReturn(new DataSet($claims, ''));

        $auth = Mockery::mock(FirebaseAuth::class);
        $auth->shouldReceive('verifyIdToken')->andReturn($token);
        $this->app->instance(FirebaseAuth::class, $auth);
    }

    public function test_new_google_user_is_created_as_passenger(): void
    {
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $this->fakeFirebase(['sub' => 'uid-1', 'email' => 'new@gmail.com', 'email_verified' => true, 'name' => 'New']);

        $this->postJson('/api/auth/login/google', ['firebase_token' => 'x'])
            ->assertOk()->assertJsonPath('user.roles', 'user');
    }

    public function test_unverified_email_cannot_take_over_existing_admin(): void
    {
        $admin = $this->makeUser('superadmin', ['email' => 'boss@jali.rw', 'firebase_uid' => null]);
        $this->fakeFirebase(['sub' => 'attacker', 'email' => 'boss@jali.rw', 'email_verified' => false]);

        $this->postJson('/api/auth/login/google', ['firebase_token' => 'x'])
            ->assertStatus(401)->assertJsonMissingPath('token');
        $this->assertNull($admin->fresh()->firebase_uid);
    }

    public function test_verified_email_links_preprovisioned_account(): void
    {
        $admin = $this->makeUser('admin', ['email' => 'agent@jali.rw', 'firebase_uid' => null]);
        $this->fakeFirebase(['sub' => 'real-uid', 'email' => 'agent@jali.rw', 'email_verified' => true]);

        $this->postJson('/api/auth/login/google', ['firebase_token' => 'x'])
            ->assertOk()->assertJsonPath('user.roles', 'admin');
        $this->assertSame('real-uid', $admin->fresh()->firebase_uid);
    }

    public function test_account_already_linked_to_another_firebase_user_is_not_relinked(): void
    {
        $this->makeUser('admin', ['email' => 'agent@jali.rw', 'firebase_uid' => 'original']);
        $this->fakeFirebase(['sub' => 'other', 'email' => 'agent@jali.rw', 'email_verified' => true]);

        $this->postJson('/api/auth/login/google', ['firebase_token' => 'x'])->assertStatus(401);
        $this->assertSame(1, User::where('email', 'agent@jali.rw')->count());
    }

    public function test_invalid_token_is_rejected(): void
    {
        $auth = Mockery::mock(FirebaseAuth::class);
        $auth->shouldReceive('verifyIdToken')->andThrow(new \RuntimeException('bad'));
        $this->app->instance(FirebaseAuth::class, $auth);

        $this->postJson('/api/auth/login/google', ['firebase_token' => 'x'])->assertStatus(401);
    }
}
