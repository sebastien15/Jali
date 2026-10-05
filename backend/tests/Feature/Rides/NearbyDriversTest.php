<?php

namespace Tests\Feature\Rides;

use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Role;
use App\Models\User;
use App\Services\Rides\NearbyDrivers;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

class NearbyDriversTest extends TestCase
{
    use RefreshDatabase;

    /** Kigali city centre → Kimironko (~6 km) */
    private array $query = ['lat' => -1.9441, 'lng' => 30.0619, 'dest_lat' => -1.9500, 'dest_lng' => 30.1250];

    private User $rider;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(now()->setTimezone('Africa/Kigali')->setTime(14, 0)->utc());   // daytime prices
        $this->rider = User::create(['name' => 'Rider', 'role_id' => Role::where('name', 'user')->value('id')]);
    }

    private function onlineDriver(string $name, float $lat, float $lng, int $perKm = 400, string $class = 'car',
                                  string $status = 'verified', bool $live = true, bool $outOfBand = false): User
    {
        static $n = 0;
        $n++;
        $driver = User::create(['name' => $name, 'phone' => "+25078800$n", 'role_id' => Role::where('name', 'driver')->value('id')]);
        $driver->driverProfile()->create(['services' => ['ride']])->forceFill([
            'verification_status' => $status, 'rating_avg' => 4.8, 'trips_count' => 120,
        ])->save();
        $vehicle = $driver->vehicles()->create([
            'model' => 'RAV4', 'make' => 'Toyota', 'color' => 'White', 'plate' => "RAB {$n}00A", 'class' => $class,
            'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear(), 'photos' => ['front' => '/storage/v.jpg'],
        ]);
        DriverRate::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => $perKm,
            'min_fare' => 1500, 'out_of_band_at' => $outOfBand ? now() : null]);
        DriverPresence::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => $lat, 'lng' => $lng, 'last_seen_at' => $live ? now() : now()->subMinutes(5), 'online_since' => now()]);

        return $driver;
    }

    /** @test */
    public function riders_see_nearby_drivers_with_their_own_price_for_this_trip()
    {
        $close = $this->onlineDriver('Jean Paul Habimana', -1.9450, 30.0630, 400);
        $cheaperFarther = $this->onlineDriver('Alice Uwase', -1.9600, 30.0700, 300);
        Sanctum::actingAs($this->rider);

        $response = $this->getJson('/api/rides/nearby?' . http_build_query($this->query))->assertOk();
        OpenApiContract::assertResponse($response, 'get', '/rides/nearby');

        $response->assertJsonCount(2, 'drivers')
            ->assertJsonPath('drivers.0.driver_id', $close->id)          // closest first
            ->assertJsonPath('drivers.0.name', 'Jean H.')
            ->assertJsonPath('drivers.0.vehicle.model', 'Toyota RAV4')
            ->assertJsonPath('drivers.0.rating', 4.8)
            ->assertJsonPath('drivers.1.driver_id', $cheaperFarther->id);

        $trip = $response->json('trip');
        $this->assertGreaterThan(6, $trip['distance_km']);
        // Each price comes from that driver's own per-km rate
        $this->assertLessThan($response->json('drivers.0.quote'), $response->json('drivers.1.quote'));
        // Positions are rounded, no phone numbers anywhere
        $this->assertSame(-1.945, $response->json('drivers.0.approx_location.lat'));
        $this->assertStringNotContainsString('+25078800', $response->getContent());
    }

    /** @test */
    public function offline_far_unverified_out_of_band_and_wrong_class_drivers_are_excluded()
    {
        $this->onlineDriver('Stale', -1.9445, 30.0620, live: false);
        $this->onlineDriver('Far', -1.5000, 29.6300);                     // Musanze
        $this->onlineDriver('Pending', -1.9445, 30.0620, status: 'pending');
        $this->onlineDriver('Suspended', -1.9445, 30.0620, status: 'suspended');
        $this->onlineDriver('Old prices', -1.9445, 30.0620, outOfBand: true);
        $moto = $this->onlineDriver('Moto', -1.9445, 30.0620, perKm: 300, class: 'moto');
        Sanctum::actingAs($this->rider);

        $this->getJson('/api/rides/nearby?' . http_build_query($this->query))
            ->assertOk()->assertJsonCount(1, 'drivers')->assertJsonPath('drivers.0.driver_id', $moto->id);

        $this->getJson('/api/rides/nearby?' . http_build_query($this->query + ['class' => 'car']))
            ->assertOk()->assertJsonCount(0, 'drivers');
    }

    /** @test */
    public function a_driver_never_sees_themselves()
    {
        $driver = $this->onlineDriver('Me', -1.9445, 30.0620);
        Sanctum::actingAs($driver);

        $this->getJson('/api/rides/nearby?' . http_build_query($this->query))->assertOk()->assertJsonCount(0, 'drivers');
    }

    /** @test */
    public function query_is_validated_and_guarded()
    {
        $this->getJson('/api/rides/nearby?' . http_build_query($this->query))->assertStatus(401);
        Sanctum::actingAs($this->rider);

        $response = $this->getJson('/api/rides/nearby?lat=999&lng=30&class=bus')->assertStatus(422)
            ->assertJsonValidationErrors(['lat', 'dest_lat', 'dest_lng', 'class']);
        OpenApiContract::assertResponse($response, 'get', '/rides/nearby');
    }

    /** @test */
    public function display_names_hide_surnames()
    {
        $this->assertSame('Jean H.', NearbyDrivers::displayName('Jean Paul Habimana'));
        $this->assertSame('Alice', NearbyDrivers::displayName('Alice'));
        $this->assertSame('Driver', NearbyDrivers::displayName(''));
    }

    /** @test */
    public function nearby_search_stays_fast_with_500_online_drivers()
    {
        for ($i = 0; $i < 500; $i++) {
            $this->onlineDriver("Driver $i", -1.9441 + (mt_rand(-300, 300) / 10000), 30.0619 + (mt_rand(-300, 300) / 10000), 300 + $i % 200);
        }
        Sanctum::actingAs($this->rider);

        $start = microtime(true);
        $response = $this->getJson('/api/rides/nearby?' . http_build_query($this->query))->assertOk();
        $ms = (microtime(true) - $start) * 1000;

        $response->assertJsonCount(NearbyDrivers::MAX_RESULTS, 'drivers');
        // Target is < 500 ms in production (MySQL); allow headroom for slow CI runners.
        $this->assertLessThan(1500, $ms, "nearby took {$ms} ms");
        fwrite(STDERR, sprintf("\n[perf] /rides/nearby with 500 online drivers: %.0f ms\n", $ms));
    }
}
