<?php

namespace Tests\Feature\Locations;

use App\Models\ActivityLog;
use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\Role;
use App\Models\ServiceArea;
use App\Models\User;
use App\Modules\Locations\Application\ServiceAreaDirectory;
use App\Modules\Locations\Contracts\ServiceAreas;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** S10.4: service areas, zones, per-city overrides and "Not available here yet". */
class ServiceAreaTest extends TestCase
{
    use RefreshDatabase;

    private const KIGALI = ['lat' => -1.9441, 'lng' => 30.0619];
    private const MUSANZE = ['lat' => -1.4993, 'lng' => 29.6345];
    private const DEST = ['dest_lat' => -1.9500, 'dest_lng' => 30.1250];

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(now()->setTimezone('Africa/Kigali')->setTime(14, 0)->utc());
    }

    private function as(string $role): User
    {
        $user = User::create(['name' => $role, 'role_id' => Role::where('name', $role)->value('id')]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function check(array $point, string $service = 'rides')
    {
        $response = $this->getJson('/api/service-areas/check?' . http_build_query($point + ['service' => $service]))->assertOk();
        OpenApiContract::assertResponse($response, 'get', '/service-areas/check');

        return $response;
    }

    private function overrideKigali(array $overrides): void
    {
        ServiceArea::where('name', 'Kigali')->update(['overrides' => json_encode($overrides)]);
        ServiceAreaDirectory::forget();
    }

    private function onlineDriver(int $perKm = 400): User
    {
        $driver = User::create(['name' => 'Jean Paul', 'phone' => '+250788222222', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $driver->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified'])->save();
        $vehicle = $driver->vehicles()->create(['model' => 'RAV4', 'make' => 'Toyota', 'color' => 'White', 'plate' => 'RAB 123A',
            'class' => 'car', 'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear(), 'photos' => ['front' => '/storage/f.jpg']]);
        DriverRate::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => $perKm, 'min_fare' => 1500]);
        DriverPresence::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => -1.9450, 'lng' => 30.0630, 'last_seen_at' => now(), 'online_since' => now()]);

        return $driver;
    }

    public function test_kigali_is_served_and_other_seeded_cities_are_switched_off(): void
    {
        $this->as('superadmin');
        $list = $this->getJson('/api/admin/service-areas')->assertOk();
        OpenApiContract::assertResponse($list, 'get', '/admin/service-areas');
        $byName = collect($list->json('data'))->keyBy('name');
        $this->assertTrue($byName['Kigali']['active']);
        $this->assertSame(1, $byName['Kigali']['zones_count']);
        $this->assertFalse($byName['Musanze']['active']);
        $this->assertSame('airport', $byName['Kigali International Airport']['zone_type']);
        $this->assertSame('Kigali', $byName['Kigali International Airport']['parent_name']);

        $this->as('user');
        $this->check(self::KIGALI)->assertJsonPath('served', true)->assertJsonPath('area.name', 'Kigali');
        $this->check(self::MUSANZE)->assertJsonPath('served', false)->assertJsonPath('area', null)
            ->assertJsonPath('message', 'Not available here yet. Jali currently works in Kigali.');
    }

    public function test_superadmin_adds_cities_and_zones_by_circle_or_geojson_and_it_is_logged(): void
    {
        $admin = $this->as('superadmin');
        $musanze = ServiceArea::where('name', 'Musanze')->value('id');

        $res = $this->putJson("/api/admin/service-areas/$musanze", [
            'active' => true, 'circle' => self::MUSANZE + ['radius_km' => 8],
            'overrides' => ['commission_pct' => 3, 'services' => ['hire' => false, 'rides' => true, 'teleport' => true]],
        ])->assertOk()->assertJsonPath('active', true)->assertJsonPath('overrides.commission_pct', 3)
            ->assertJsonPath('overrides.services.hire', false)->assertJsonPath('overrides.services.rides', true)
            ->assertJsonMissingPath('overrides.services.teleport');
        OpenApiContract::assertResponse($res, 'put', '/admin/service-areas/{id}');
        $this->assertCount(24, $res->json('polygon'));

        // Zone from an uploaded GeoJSON polygon ([lng, lat] order, first point repeated)
        $geojson = ['type' => 'Feature', 'geometry' => ['type' => 'Polygon', 'coordinates' => [[
            [30.0600, -1.9460], [30.0640, -1.9460], [30.0640, -1.9420], [30.0600, -1.9420], [30.0600, -1.9460],
        ]]]];
        $zone = $this->postJson('/api/admin/service-areas', [
            'name' => 'Amahoro Stadium', 'kind' => 'zone', 'zone_type' => 'stadium', 'active' => true,
            'parent_id' => ServiceArea::where('name', 'Kigali')->value('id'), 'geojson' => json_encode($geojson),
        ])->assertCreated()->assertJsonPath('polygon.0', [-1.946, 30.06])->assertJsonCount(4, 'polygon');
        OpenApiContract::assertResponse($zone, 'post', '/admin/service-areas');

        $areas = app(ServiceAreas::class);
        $this->assertSame(['Amahoro Stadium'], array_column($areas->zonesAt(self::KIGALI['lat'], self::KIGALI['lng']), 'name'));
        $this->assertSame(['Kigali International Airport'], array_column($areas->zones('airport'), 'name'));

        $this->postJson('/api/admin/service-areas', ['name' => 'X', 'kind' => 'city'])->assertStatus(422)->assertJsonValidationErrors('polygon');
        $this->postJson('/api/admin/service-areas', ['name' => 'Y', 'kind' => 'zone', 'circle' => self::KIGALI + ['radius_km' => 1]])
            ->assertStatus(422)->assertJsonValidationErrors('zone_type');
        $this->postJson('/api/admin/service-areas', ['name' => 'Z', 'kind' => 'zone', 'zone_type' => 'pickup',
            'parent_id' => $zone->json('id'), 'circle' => self::KIGALI + ['radius_km' => 1]])->assertStatus(422)->assertJsonValidationErrors('parent_id');

        $this->deleteJson('/api/admin/service-areas/' . ServiceArea::where('name', 'Kigali')->value('id'))->assertStatus(409);
        $this->deleteJson('/api/admin/service-areas/' . $zone->json('id'))->assertNoContent();

        $this->assertSame(3, ActivityLog::where('admin_id', $admin->id)->where('entity_type', 'service_area')->count());

        $this->as('user');
        $this->check(self::MUSANZE)->assertJsonPath('served', true)->assertJsonPath('area.name', 'Musanze');
        $this->check(self::MUSANZE, 'hire')->assertJsonPath('served', false)
            ->assertJsonPath('message', 'Hire a driver is not available in Musanze yet.');
    }

    public function test_only_superadmin_manages_service_areas(): void
    {
        foreach (['admin', 'driver', 'user'] as $role) {
            $this->as($role);
            $this->getJson('/api/admin/service-areas')->assertStatus(403);
            $this->postJson('/api/admin/service-areas', ['name' => 'X', 'kind' => 'city', 'circle' => self::KIGALI + ['radius_km' => 5]])->assertStatus(403);
        }
        $this->assertSame(5, ServiceArea::count());
    }

    public function test_rides_outside_an_active_city_get_not_available_here_yet(): void
    {
        $this->onlineDriver();
        $this->as('user');

        $this->getJson('/api/rides/nearby?' . http_build_query(self::KIGALI + self::DEST))->assertOk()->assertJsonCount(1, 'drivers');
        $this->getJson('/api/rides/nearby?' . http_build_query(self::MUSANZE + self::DEST))->assertStatus(422)
            ->assertJsonPath('message', 'Not available here yet. Jali currently works in Kigali.');

        $this->overrideKigali(['services' => ['rides' => false]]);
        $this->getJson('/api/rides/nearby?' . http_build_query(self::KIGALI + self::DEST))->assertStatus(422)
            ->assertJsonPath('message', 'Rides is not available in Kigali yet.');

        // No active city at all: the area check is switched off
        ServiceArea::query()->update(['active' => false]);
        ServiceAreaDirectory::forget();
        $this->getJson('/api/rides/nearby?' . http_build_query(self::MUSANZE + self::DEST))->assertOk()->assertJsonCount(0, 'drivers');
    }

    public function test_city_overrides_set_the_commission_and_guardrails_of_rides_there(): void
    {
        $driver = $this->onlineDriver(400);
        $this->overrideKigali(['commission_pct' => 5]);
        $this->as('user');

        $ride = $this->postJson('/api/rides', [
            'mode' => 'pick', 'driver_id' => $driver->id, 'payment_method' => 'cash',
            'pickup' => self::KIGALI + ['address' => 'Kiyovu'], 'dropoff' => ['lat' => -1.9500, 'lng' => 30.1250, 'address' => 'Kimironko'],
        ])->assertCreated()->json();
        $this->assertEquals(5, Ride::find($ride['id'])->commission_pct);

        // A stricter Kigali per-km band hides drivers priced above it
        $this->overrideKigali(['vehicle_classes' => ['car' => ['per_km_min' => 300, 'per_km_max' => 350, 'min_fare_max' => 5000]]]);
        $this->getJson('/api/rides/nearby?' . http_build_query(self::KIGALI + self::DEST))->assertOk()->assertJsonCount(0, 'drivers');
    }
}
