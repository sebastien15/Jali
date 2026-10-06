<?php

namespace Tests\Feature\Rides;

use App\Models\DriverRate;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

class DriverRatesTest extends TestCase
{
    use RefreshDatabase;

    private User $driver;

    private array $rates = [
        'base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500,
        'pickup_free_km' => 2, 'pickup_per_km' => 200, 'night_multiplier' => 1.2,
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->driver = $this->user('driver', 'ExponentPushToken[driver]');
    }

    private function user(string $role, ?string $token = null): User
    {
        return User::create(['name' => $role, 'fcm_token' => $token, 'role_id' => Role::where('name', $role)->value('id')]);
    }

    private function withCar(User $user, string $class = 'car'): void
    {
        $user->vehicles()->create(['model' => 'Toyota RAV4', 'plate' => 'RAB ' . $user->id . '00A', 'class' => $class]);
    }

    /** @test */
    public function driver_without_vehicle_sees_guardrails_and_cannot_save()
    {
        Sanctum::actingAs($this->driver);

        $response = $this->getJson('/api/driver/rates')
            ->assertOk()
            ->assertJsonPath('vehicle', null)
            ->assertJsonPath('rates', null)
            ->assertJsonPath('guardrails.per_km_max', 1200);
        OpenApiContract::assertResponse($response, 'get', '/driver/rates');

        $response = $this->putJson('/api/driver/rates', $this->rates)->assertStatus(422)->assertJsonValidationErrors(['vehicle']);
        OpenApiContract::assertResponse($response, 'put', '/driver/rates');
    }

    /** @test */
    public function driver_sets_own_rates_and_gets_a_price_preview()
    {
        $this->withCar($this->driver);
        Sanctum::actingAs($this->driver);

        $response = $this->putJson('/api/driver/rates', $this->rates)
            ->assertOk()
            ->assertJsonPath('rates.per_km', 400)
            ->assertJsonPath('preview.0.km', 2)
            ->assertJsonPath('preview.0.driver_fare', 1500)   // 500 + 800 → min fare 1500
            ->assertJsonPath('preview.1.driver_fare', 2500)   // 500 + 2000
            ->assertJsonPath('preview.1.total', 2700)         // + 200 service fee
            ->assertJsonPath('preview.2.driver_fare', 4500);
        OpenApiContract::assertResponse($response, 'put', '/driver/rates');

        OpenApiContract::assertResponse(
            $this->getJson('/api/driver/rates')->assertJsonPath('rates.base_fare', 500), 'get', '/driver/rates');

        // Saving again updates instead of duplicating
        $this->putJson('/api/driver/rates', ['per_km' => 450] + $this->rates)->assertOk();
        $this->assertSame(1, DriverRate::count());
    }

    /** @test */
    public function rates_outside_the_guardrails_for_the_vehicle_class_are_rejected()
    {
        $this->withCar($this->driver, 'moto');   // moto: 150–600 per km, min fare ≤ 1500
        Sanctum::actingAs($this->driver);

        $this->putJson('/api/driver/rates', ['per_km' => 900, 'min_fare' => 3000] + $this->rates)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['per_km', 'min_fare'])
            ->assertJsonPath('errors.per_km.0', 'Price per km for this vehicle must be between 150 and 600 RWF.');
    }

    /** @test */
    public function applicants_can_set_rates_but_accounts_without_permission_cannot()
    {
        $this->getJson('/api/driver/rates')->assertStatus(401);

        $applicant = $this->user('user');
        $this->withCar($applicant);
        Sanctum::actingAs($applicant);
        $this->putJson('/api/driver/rates', $this->rates)->assertOk();

        Sanctum::actingAs(User::create(['name' => 'No role']));
        $this->getJson('/api/driver/rates')->assertStatus(403);
        $this->putJson('/api/driver/rates', $this->rates)->assertStatus(403);
    }

    /** @test */
    public function tightening_guardrails_flags_and_notifies_drivers_outside_them_once()
    {
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->withCar($this->driver);
        Sanctum::actingAs($this->driver);
        $this->putJson('/api/driver/rates', ['per_km' => 1000] + $this->rates)->assertOk();

        Sanctum::actingAs($this->user('superadmin'));
        $limits = ['vehicle_classes' => ['car' => ['per_km_min' => 300, 'per_km_max' => 800, 'min_fare_max' => 5000]]];
        $this->putJson('/api/admin/settings/rides', $limits)->assertOk();
        $this->putJson('/api/admin/settings/rides', $limits)->assertOk();   // second save must not re-notify

        $this->assertNotNull(DriverRate::first()->out_of_band_at);
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[driver]' && $r['title'] === 'Please update your prices');

        Sanctum::actingAs($this->driver);
        $this->getJson('/api/driver/rates')->assertJsonPath('out_of_band', true);

        // Driver fixes the price → flag cleared
        $this->putJson('/api/driver/rates', ['per_km' => 700] + $this->rates)->assertOk()->assertJsonPath('out_of_band', false);
    }
}
