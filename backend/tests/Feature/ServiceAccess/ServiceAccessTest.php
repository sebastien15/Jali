<?php

namespace Tests\Feature\ServiceAccess;

use App\Models\ActivityLog;
use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Role;
use App\Models\ServiceArea;
use App\Models\User;
use App\Modules\Locations\Application\ServiceAreaDirectory;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** S23.1: one server answer for which services an account can see, use and offer. */
class ServiceAccessTest extends TestCase
{
    use RefreshDatabase;

    private const KIGALI = ['lat' => -1.9441, 'lng' => 30.0619];
    private const MUSANZE = ['lat' => -1.4993, 'lng' => 29.6345];

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(now()->setTimezone('Africa/Kigali')->setTime(14, 0)->utc());
    }

    private function as(string $role, string $phone = '+250788000001'): User
    {
        $user = User::create(['name' => $role, 'phone' => $phone, 'role_id' => Role::where('name', $role)->value('id')]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function access(array $query = [], array $headers = []): array
    {
        $response = $this->getJson('/api/me/service-access' . ($query ? '?' . http_build_query($query) : ''), $headers)->assertOk();
        OpenApiContract::assertResponse($response, 'get', '/me/service-access');

        return collect($response->json('services'))->keyBy('id')->all();
    }

    private function driver(array $services = ['ride'], string $status = 'verified'): User
    {
        $driver = User::create(['name' => 'Jean Paul', 'phone' => '+250788222222', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $driver->driverProfile()->create(['services' => $services])->forceFill(['verification_status' => $status])->save();
        $vehicle = $driver->vehicles()->create(['model' => 'RAV4', 'make' => 'Toyota', 'color' => 'White', 'plate' => 'RAB 123A',
            'class' => 'car', 'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear(), 'photos' => ['front' => '/storage/f.jpg']]);
        DriverRate::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500]);
        DriverPresence::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => -1.9450, 'lng' => 30.0630, 'last_seen_at' => now(), 'online_since' => now()]);

        return $driver;
    }

    private function rideRequest(User $driver): array
    {
        return ['mode' => 'pick', 'driver_id' => $driver->id, 'payment_method' => 'cash',
            'pickup' => self::KIGALI + ['address' => 'Kiyovu'], 'dropoff' => ['lat' => -1.9500, 'lng' => 30.1250, 'address' => 'Kimironko']];
    }

    private function setServices(array $values): void
    {
        $this->as('superadmin', '+250788000009');
        $this->putJson('/api/admin/services', $values)->assertOk();
    }

    public function test_defaults_keep_every_built_service_on_and_cargo_off(): void
    {
        $this->as('user');
        $s = $this->access();

        foreach (['rides', 'hire', 'rental', 'shared', 'bus'] as $id) {
            $this->assertTrue($s[$id]['discoverable'], $id);
            $this->assertTrue($s[$id]['accepting_new_requests'], $id);
            $this->assertTrue($s[$id]['can_use'], $id);
            $this->assertFalse($s[$id]['can_offer'], $id);
            $this->assertNull($s[$id]['reason_code'], $id);
        }
        $this->assertFalse($s['cargo']['discoverable']);
        $this->assertSame('not_released', $s['cargo']['reason_code']);
        $this->assertTrue($s['rides']['can_configure']);   // can apply to drive
    }

    public function test_offering_follows_permission_and_verification_not_persona(): void
    {
        $verified = $this->driver(['ride']);
        Sanctum::actingAs($verified);
        $s = $this->access();
        $this->assertTrue($s['rides']['can_offer']);
        $this->assertFalse($s['hire']['can_offer']);       // not a verified hire service
        $this->assertTrue($s['shared']['can_offer']);       // driver role lists private seats

        $verified->driverProfile->forceFill(['verification_status' => 'pending'])->save();
        $this->assertFalse($this->access()['rides']['can_offer']);
    }

    public function test_region_gates_local_services_only(): void
    {
        $this->as('user');
        $s = $this->access(self::MUSANZE);
        $this->assertSame('not_in_area', $s['rides']['reason_code']);
        $this->assertFalse($s['rides']['accepting_new_requests']);
        $this->assertTrue($s['rides']['discoverable']);
        $this->assertTrue($s['rental']['accepting_new_requests']);   // not tied to where you stand
        $this->assertTrue($s['bus']['accepting_new_requests']);

        ServiceArea::where('name', 'Kigali')->update(['overrides' => json_encode(['services' => ['hire' => false, 'rental' => false]])]);
        ServiceAreaDirectory::forget();
        $s = $this->access(self::KIGALI);
        $this->assertNull($s['rides']['reason_code']);
        $this->assertSame(['id' => ServiceArea::where('name', 'Kigali')->value('id'), 'name' => 'Kigali'], $s['rides']['area']);
        $this->assertSame('off_in_area', $s['hire']['reason_code']);
        $this->assertSame('off_in_area', $s['rental']['reason_code']);
    }

    public function test_superadmin_changes_flags_it_is_logged_and_cargo_cannot_be_enabled(): void
    {
        $admin = $this->as('superadmin');
        $res = $this->putJson('/api/admin/services', ['rides' => ['accepting_new_requests' => false], 'bus' => ['minimum_app_version' => '1.2']])
            ->assertOk()->assertJsonPath('rides.accepting_new_requests', false)->assertJsonPath('rides.discoverable', true)
            ->assertJsonPath('bus.minimum_app_version', '1.2');
        OpenApiContract::assertResponse($res, 'put', '/admin/services');
        OpenApiContract::assertResponse($this->getJson('/api/admin/services')->assertOk(), 'get', '/admin/services');
        $this->assertSame($admin->id, ActivityLog::where('action', 'services_updated')->value('admin_id'));

        $this->putJson('/api/admin/services', ['cargo' => ['accepting_new_requests' => true]])
            ->assertStatus(422)->assertJsonValidationErrors('cargo.accepting_new_requests');
        $this->putJson('/api/admin/services', ['bus' => ['minimum_app_version' => 'latest']])->assertStatus(422);

        foreach (['admin', 'driver', 'user'] as $i => $role) {
            $this->as($role, "+25078800010$i");
            $this->getJson('/api/admin/services')->assertStatus(403);
            $this->putJson('/api/admin/services', ['rides' => ['accepting_new_requests' => true]])->assertStatus(403);
        }
    }

    public function test_paused_service_refuses_new_work_but_keeps_active_work(): void
    {
        $driver = $this->driver(['ride']);
        $rider = $this->as('user');
        $ride = $this->postJson('/api/rides', $this->rideRequest($driver))->assertCreated()->json();

        $this->setServices(['rides' => ['accepting_new_requests' => false]]);

        // Another rider can't start a new ride…
        $this->as('user', '+250788000077');
        $refused = $this->postJson('/api/rides', $this->rideRequest($driver))->assertStatus(403)
            ->assertJsonPath('reason_code', 'paused');
        $this->assertStringContainsString('existing bookings are not affected', $refused->json('message'));
        $this->assertSame('paused', $this->access()['rides']['reason_code']);

        // …but the ride already requested goes on
        Sanctum::actingAs($rider);
        $this->getJson('/api/rides/active')->assertOk()->assertJsonPath('id', $ride['id']);
        Sanctum::actingAs($driver);
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertOk()->assertJsonPath('status', 'accepted');
        Sanctum::actingAs($rider);
        $this->getJson('/api/rides')->assertOk()->assertJsonPath('data.0.id', $ride['id']);
    }

    public function test_minimum_app_version_gates_reporting_clients_only(): void
    {
        $driver = $this->driver(['ride']);
        $this->setServices(['rides' => ['minimum_app_version' => '2.0.0']]);
        $this->as('user');

        $this->assertSame('app_update_required', $this->access(['app_version' => '1.5.0'])['rides']['reason_code']);
        $this->assertNull($this->access(['app_version' => '2.1'])['rides']['reason_code']);
        $this->postJson('/api/rides', $this->rideRequest($driver), ['X-App-Version' => '1.5.0'])
            ->assertStatus(403)->assertJsonPath('reason_code', 'app_update_required');

        // Old builds send no version: not gated (documented default)
        $this->assertNull($this->access()['rides']['reason_code']);
        $this->postJson('/api/rides', $this->rideRequest($driver))->assertCreated();
    }

    public function test_legacy_booking_types_follow_their_service(): void
    {
        $this->setServices(['bus' => ['accepting_new_requests' => false], 'shared' => ['discoverable' => false, 'accepting_new_requests' => false]]);
        $this->as('user');

        $this->postJson('/api/bookings', ['type' => 'trip', 'reference_id' => 1, 'payment_method' => 'Card'])
            ->assertStatus(403)->assertJsonPath('reason_code', 'paused');
        $this->postJson('/api/bookings', ['type' => 'bus', 'reference_id' => 1, 'payment_method' => 'Card'])
            ->assertStatus(403)->assertJsonPath('reason_code', 'paused');
        $this->postJson('/api/bookings', ['type' => 'private', 'reference_id' => 1, 'payment_method' => 'Card'])
            ->assertStatus(403)->assertJsonPath('reason_code', 'not_released');
        $this->postJson('/api/bookings', ['type' => 'rental', 'reference_id' => 999, 'payment_method' => 'Card'])
            ->assertNotFound();   // rental still on: the normal lookup runs
        $this->getJson('/api/bookings')->assertOk();   // history stays reachable
    }
}
