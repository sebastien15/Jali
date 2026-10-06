<?php

namespace Tests\Feature\Rides;

use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Role;
use App\Models\User;
use App\Modules\Providers\Application\DriverEligibility as E;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

class DriverPresenceTest extends TestCase
{
    use RefreshDatabase;

    private array $kigali = ['lat' => -1.9441, 'lng' => 30.0619, 'heading' => 90];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    /** A verified driver with an insured, photographed car and prices. */
    private function readyDriver(): User
    {
        $driver = User::create(['name' => 'Jean', 'phone' => '+250788', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $driver->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified', 'submitted_at' => now()])->save();
        $vehicle = $driver->vehicles()->create([
            'model' => 'RAV4', 'plate' => 'RAB 1' . $driver->id . 'A', 'class' => 'car', 'is_active' => true,
            'insurance_expiry' => now()->addMonths(3), 'photos' => ['front' => '/storage/x.jpg'],
        ]);
        DriverRate::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500]);

        return $driver;
    }

    /** @test */
    public function a_ready_driver_goes_online_and_offline()
    {
        $driver = $this->readyDriver();
        Sanctum::actingAs($driver);

        $response = $this->postJson('/api/driver/presence', ['online' => true] + $this->kigali)
            ->assertOk()->assertJsonPath('online', true)->assertJsonPath('blocked_reasons', []);
        OpenApiContract::assertResponse($response, 'post', '/driver/presence');

        $presence = DriverPresence::find($driver->id);
        $this->assertEqualsWithDelta(-1.9441, $presence->lat, 0.00001);
        $since = $presence->online_since;

        // Heartbeats keep the original online_since
        $this->travel(8)->seconds();
        $this->postJson('/api/driver/presence', ['online' => true] + $this->kigali)->assertJsonPath('online', true);
        $this->assertEquals($since, DriverPresence::find($driver->id)->online_since);

        OpenApiContract::assertResponse($this->getJson('/api/driver/presence')->assertJsonPath('online', true), 'get', '/driver/presence');

        $this->postJson('/api/driver/presence', ['online' => false])->assertOk()->assertJsonPath('online', false);
        $this->assertFalse(DriverPresence::find($driver->id)->is_online);
    }

    /** @test */
    public function going_online_explains_what_is_missing()
    {
        $driver = $this->readyDriver();
        Sanctum::actingAs($driver);
        $vehicle = $driver->vehicles()->first();

        $vehicle->update(['insurance_expiry' => now()->subDay(), 'photos' => null]);
        DriverRate::query()->update(['out_of_band_at' => now()]);
        $this->postJson('/api/driver/presence', ['online' => true] + $this->kigali)->assertOk()
            ->assertJsonPath('online', false)
            ->assertJsonPath('blocked_reasons', [E::INSURANCE_EXPIRED, E::NO_FRONT_PHOTO, E::RATES_OUT_OF_BAND]);

        $vehicle->update(['is_active' => false]);
        $this->postJson('/api/driver/presence', ['online' => true] + $this->kigali)
            ->assertJsonPath('blocked_reasons', [E::NO_VEHICLE, E::NO_RATES]);
        $this->assertFalse((bool) DriverPresence::find($driver->id)?->is_online);
    }

    /** @test */
    public function suspended_or_unverified_drivers_cannot_go_online()
    {
        $driver = $this->readyDriver();
        Sanctum::actingAs($driver);

        $driver->driverProfile->forceFill(['verification_status' => 'suspended'])->save();
        $this->postJson('/api/driver/presence', ['online' => true] + $this->kigali)->assertJsonPath('blocked_reasons', [E::SUSPENDED]);

        $driver->driverProfile->forceFill(['verification_status' => 'pending'])->save();
        $this->postJson('/api/driver/presence', ['online' => true] + $this->kigali)->assertJsonPath('blocked_reasons', [E::NOT_VERIFIED]);
    }

    /** @test */
    public function position_is_required_to_go_online()
    {
        Sanctum::actingAs($this->readyDriver());

        $response = $this->postJson('/api/driver/presence', ['online' => true])->assertStatus(422)->assertJsonValidationErrors(['lat', 'lng']);
        OpenApiContract::assertResponse($response, 'post', '/driver/presence');
    }

    /** @test */
    public function drivers_without_a_heartbeat_are_offline_and_get_expired()
    {
        $driver = $this->readyDriver();
        Sanctum::actingAs($driver);
        $this->postJson('/api/driver/presence', ['online' => true] + $this->kigali)->assertJsonPath('online', true);

        $this->travel(61)->seconds();   // default presence_ttl_sec = 60
        $this->getJson('/api/driver/presence')->assertJsonPath('online', false);
        $this->assertSame(0, DriverPresence::live()->count());

        Artisan::call('rides:expire-presence');
        $this->assertFalse(DriverPresence::find($driver->id)->is_online);
    }

    /** @test */
    public function riders_and_applicants_cannot_use_presence()
    {
        $this->postJson('/api/driver/presence', ['online' => false])->assertStatus(401);
        Sanctum::actingAs(User::create(['name' => 'Rider', 'role_id' => Role::where('name', 'user')->value('id')]));
        $this->postJson('/api/driver/presence', ['online' => true] + $this->kigali)->assertStatus(403);
    }
}
