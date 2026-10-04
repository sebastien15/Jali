<?php

namespace Tests\Feature;

use App\Models\AdminStation;
use App\Models\AppAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_station_list_hides_staff_details(): void
    {
        $admin = $this->makeUser('admin', ['email' => 'agent@jali.rw']);
        AdminStation::create(['city' => 'Huye', 'name' => 'Huye Terminal', 'user_id' => $admin->id]);
        $this->actingAsRole('user');

        $body = $this->getJson('/api/stations')->assertOk()->getContent();

        $this->assertStringNotContainsString('agent@jali.rw', $body);
        $this->assertStringNotContainsString('admin_name', $body);
    }

    public function test_superadmin_still_sees_station_admins(): void
    {
        $admin = $this->makeUser('admin', ['email' => 'agent@jali.rw']);
        AdminStation::create(['city' => 'Huye', 'name' => 'Huye Terminal', 'user_id' => $admin->id]);
        $this->actingAsRole('superadmin');

        $this->getJson('/api/admin/stations')->assertOk()->assertJsonFragment(['admin_email' => 'agent@jali.rw']);
    }

    public function test_access_tracking_records_logged_in_user_and_is_throttled(): void
    {
        $user = $this->makeUser('user');
        $token = $user->createToken('api-token')->plainTextToken;

        $this->withToken($token)->postJson('/api/track-access', ['platform' => 'android'])->assertOk();
        $this->assertSame($user->id, (int) AppAccess::latest('id')->value('user_id'));

        for ($i = 0; $i < 20; $i++) {
            $this->postJson('/api/track-access', ['platform' => 'web']);
        }
        $this->postJson('/api/track-access', ['platform' => 'web'])->assertStatus(429);
    }

    public function test_tokens_expire(): void
    {
        $this->assertNotNull(config('sanctum.expiration'));

        $user = $this->makeUser('user');
        $token = $user->createToken('api-token');
        $token->accessToken->forceFill(['created_at' => now()->subDays(31)])->save();

        $this->withToken($token->plainTextToken)->getJson('/api/me')->assertStatus(401);
    }

    public function test_production_seed_has_no_demo_users_or_shared_password(): void
    {
        $this->app['env'] = 'production';
        $this->artisan('db:seed', ['--force' => true]);

        $this->assertDatabaseMissing('users', ['email' => 'user@jali.rw']);
        $this->assertSame(0, \App\Models\Booking::count());
        $superadmin = \App\Models\User::where('email', 'superadmin@jali.rw')->first();
        $this->assertFalse(\Illuminate\Support\Facades\Hash::check('Jali@2026', $superadmin->password));
    }
}
