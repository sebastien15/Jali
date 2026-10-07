<?php

namespace Tests\Feature\Hire;

use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\PushService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** S13.7: hire a driver with their car — 2/4/8 h packages, km allowance, extra time and km charged. */
class HireWithCarTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $driver;
    private Vehicle $car;

    private const RATES = [
        'hourly_rate' => 3000, 'min_hours' => 2, 'daily_rate' => 25000, 'daily_hours' => 10, 'overtime_per_hour' => 4000,
        'transmissions' => ['automatic'], 'languages' => ['rw', 'en'], 'years_experience' => 8,
    ];

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(Carbon::parse('2026-10-12 08:00', 'Africa/Kigali')->utc());
        $this->customer = User::create(['name' => 'Grace Uwase', 'phone' => '+250788111111', 'role_id' => Role::where('name', 'user')->value('id')]);
        $this->driver = User::create(['name' => 'Eric Nshimiyimana', 'phone' => '+250788222222', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $this->driver->driverProfile()->create(['services' => ['hire'], 'licence_categories' => ['B']])->forceFill(['verification_status' => 'verified'])->save();
        $this->car = $this->driver->vehicles()->create(['model' => 'Prado', 'make' => 'Toyota', 'color' => 'Black', 'plate' => 'RAD 777 C',
            'class' => 'comfort', 'seats' => 6, 'is_active' => true, 'insurance_expiry' => now()->addYear(), 'photos' => ['front' => '/storage/p.jpg']]);
    }

    private function offerCar(array $extra = []): \Illuminate\Testing\TestResponse
    {
        Sanctum::actingAs($this->driver);

        return $this->putJson('/api/driver/hire-settings', $extra + self::RATES + [
            'offers_car' => true, 'car_vehicle_id' => $this->car->id, 'car_hourly_rate' => 12000, 'km_per_hour' => 15, 'extra_km_rate' => 500,
        ]);
    }

    private function search(array $overrides = []): array
    {
        return $overrides + ['start_at' => Carbon::parse('2026-10-14 09:00', 'Africa/Kigali')->toIso8601String(),
            'duration_type' => 'hours', 'duration_value' => 4, 'trip_type' => 'city', 'with_car' => 1];
    }

    public function test_driver_offers_their_car_within_limits(): void
    {
        $res = $this->offerCar()->assertOk()->assertJsonPath('settings.offers_car', true)->assertJsonPath('settings.car_hourly_rate', 12000)
            ->assertJsonPath('limits.car_hourly_max', 40000);
        OpenApiContract::assertResponse($res, 'put', '/driver/hire-settings');

        $this->offerCar(['car_hourly_rate' => 99000])->assertStatus(422)->assertJsonValidationErrors('car_hourly_rate');
        $other = User::create(['name' => 'Other', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $theirs = $other->vehicles()->create(['model' => 'Vitz', 'plate' => 'RAB 1 A', 'class' => 'car', 'seats' => 4, 'is_active' => true]);
        $this->offerCar(['car_vehicle_id' => $theirs->id])->assertStatus(422)->assertJsonValidationErrors('car_vehicle_id');
    }

    public function test_packages_with_km_allowance_and_extra_time_and_km_charged(): void
    {
        $this->offerCar()->assertOk();
        Sanctum::actingAs($this->customer);

        $this->getJson('/api/driver-hire/available?' . http_build_query($this->search(['duration_value' => 3])))
            ->assertStatus(422)->assertJsonValidationErrors('duration_value');   // packages are 2, 4 or 8 h
        $found = $this->getJson('/api/driver-hire/available?' . http_build_query($this->search()))->assertOk()
            ->assertJsonCount(1, 'drivers')->assertJsonPath('drivers.0.quote.driver_total', 48000)
            ->assertJsonPath('drivers.0.quote.km_allowance', 60)->assertJsonPath('drivers.0.vehicle.model', 'Toyota Prado');
        OpenApiContract::assertResponse($found, 'get', '/driver-hire/available');
        $this->assertArrayNotHasKey('plate', $found->json('drivers.0.vehicle'));

        $hire = $this->postJson('/api/driver-hire', $this->search() + [
            'driver_id' => $this->driver->id, 'pickup' => ['lat' => -1.9536, 'lng' => 30.0927, 'address' => 'Kigali Convention Centre'],
            'accept_terms' => true,
        ])->assertCreated()->assertJsonPath('with_car', true)->assertJsonPath('km_allowance', 60)
            ->assertJsonPath('quoted_total', 48000)->assertJsonPath('vehicle.plate', null)->json();

        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertOk();
        $this->travelTo(Carbon::parse('2026-10-14 09:00', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-in")->assertStatus(422)->assertJsonValidationErrors('odometer');
        $this->postJson("/api/driver-hire/{$hire['id']}/check-in", ['odometer' => 52000])->assertOk()->assertJsonPath('odometer_start', 52000);

        // 4 h 40 min later, 85 km driven: 40 min overtime at the car rate, 25 km extra at 500
        $this->travelTo(Carbon::parse('2026-10-14 13:40', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-out", ['payment_method' => 'cash', 'odometer' => 51000])->assertStatus(422);
        $done = $this->postJson("/api/driver-hire/{$hire['id']}/check-out", ['payment_method' => 'cash', 'odometer' => 52085])->assertOk()
            ->assertJsonPath('extra_km', 25)->assertJsonPath('extra_km_amount', 12500)
            ->assertJsonPath('overtime_minutes', 40)->assertJsonPath('overtime_amount', 8000)
            ->assertJsonPath('final_total', 48000 + 8000 + 12500);
        OpenApiContract::assertResponse($done, 'post', '/driver-hire/{id}/check-out');

        Sanctum::actingAs($this->customer);
        $this->getJson("/api/driver-hire/{$hire['id']}")->assertJsonPath('vehicle.plate', 'RAD 777 C');
    }

    public function test_drivers_without_a_ready_car_are_not_offered(): void
    {
        $this->offerCar()->assertOk();
        $this->car->update(['insurance_expiry' => now()->subDay()]);
        Sanctum::actingAs($this->customer);
        $this->getJson('/api/driver-hire/available?' . http_build_query($this->search()))->assertOk()->assertJsonCount(0, 'drivers');
        // Without a car they are still hireable as a driver
        $this->getJson('/api/driver-hire/available?' . http_build_query($this->search(['with_car' => 0, 'transmission' => 'automatic'])))
            ->assertOk()->assertJsonCount(1, 'drivers')->assertJsonPath('drivers.0.quote.km_allowance', 0);
    }
}
