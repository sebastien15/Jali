<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** Story S21.7 — rate limiting and abuse protection */
class RateLimitTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function otp_codes_are_limited_to_five_per_hour_per_phone_however_it_is_typed()
    {
        $spellings = ['+250788123456', '0788123456', '250788123456', '+250 788 123 456', '0788 123 456'];
        foreach ($spellings as $phone) {
            $this->postJson('/api/auth/otp/request', ['phone' => $phone])->assertOk();
        }

        $this->postJson('/api/auth/otp/request', ['phone' => '+250788123456'])
            ->assertStatus(429)
            ->assertHeader('Retry-After')
            ->assertJsonPath('message', 'Too many codes requested for this number. Try again in an hour.');

        // Another number is not affected
        $this->postJson('/api/auth/otp/request', ['phone' => '+250788999999'])->assertOk();

        // An hour later the number can ask again
        $this->travel(61)->minutes();
        $this->postJson('/api/auth/otp/request', ['phone' => '+250788123456'])->assertOk();
    }

    /** @test */
    public function otp_requests_without_a_phone_do_not_share_one_bucket()
    {
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/otp/request', [])->assertStatus(422);
        }
        $this->postJson('/api/auth/otp/request', ['phone' => '+250788123456'])->assertOk();
    }

    /** @test */
    public function otp_guessing_is_limited_per_phone()
    {
        for ($i = 0; $i < 10; $i++) {
            $this->travel(7)->seconds(); // stay under the per-IP per-minute limit
            $this->postJson('/api/auth/otp/verify', ['phone' => '+250788123456', 'otp' => sprintf('%06d', $i)])->assertStatus(401);
        }

        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => '000099'])
            ->assertStatus(429)
            ->assertJsonPath('message', 'Too many wrong codes. Request a new code later.');
    }

    /** @test */
    public function password_sign_in_is_limited_per_ip_and_per_account()
    {
        User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => bcrypt('correct-password')]);

        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'admin@example.com', 'password' => "guess-$i"])->assertStatus(401);
        }
        $this->postJson('/api/auth/login', ['email' => 'admin@example.com', 'password' => 'correct-password'])
            ->assertStatus(429);

        // Per account: 20 per hour even when spread over minutes / IPs
        $this->travel(2)->minutes();
        for ($i = 0; $i < 10; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.' . ($i + 2)])
                ->postJson('/api/auth/login', ['email' => 'ADMIN@example.com', 'password' => "guess-$i"])->assertStatus(401);
        }
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.1'])
            ->postJson('/api/auth/login', ['email' => 'admin@example.com', 'password' => 'correct-password'])
            ->assertStatus(429)
            ->assertJsonPath('message', 'Too many sign-in attempts. Try again later.');
    }

    /** @test */
    public function every_api_route_carries_a_per_user_limit()
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::create(['name' => 'Aline', 'phone' => '+250788111111', 'role_id' => Role::where('name', 'user')->value('id')]));

        $this->getJson('/api/me')->assertOk()
            ->assertHeader('X-RateLimit-Limit', '120')
            ->assertHeader('X-RateLimit-Remaining', '119');
    }

    /** @test */
    public function ride_requests_are_limited_to_six_per_minute()
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::create(['name' => 'Aline', 'phone' => '+250788111111', 'role_id' => Role::where('name', 'user')->value('id')]));

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/rides', [])->assertStatus(422);
        }
        $response = $this->postJson('/api/rides', [])
            ->assertStatus(429)
            ->assertJsonPath('message', 'Too many ride requests. Wait a moment and try again.');
        OpenApiContract::assertResponse($response, 'post', '/rides');
    }
}
