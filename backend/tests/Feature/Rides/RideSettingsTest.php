<?php

namespace Tests\Feature\Rides;

use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use App\Modules\Pricing\Application\RideSettings;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

class RideSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function as(string $role): User
    {
        $user = User::create(['name' => $role, 'role_id' => Role::where('name', $role)->value('id')]);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    /** @test */
    public function defaults_are_returned_before_any_configuration()
    {
        $this->as('superadmin');

        $response = $this->getJson('/api/admin/settings/rides')
            ->assertOk()
            ->assertJsonPath('commission_pct', 8)
            ->assertJsonPath('vehicle_classes.moto.per_km_max', 600);

        OpenApiContract::assertResponse($response, 'get', '/admin/settings/rides');
    }

    /** @test */
    public function superadmin_can_update_part_of_the_settings_and_it_is_logged()
    {
        $admin = $this->as('superadmin');

        $response = $this->putJson('/api/admin/settings/rides', [
            'commission_pct'  => 10,
            'vehicle_classes' => ['moto' => ['per_km_min' => 200, 'per_km_max' => 500, 'min_fare_max' => 1200]],
        ])->assertOk()
            ->assertJsonPath('commission_pct', 10)
            ->assertJsonPath('vehicle_classes.moto.per_km_min', 200)
            ->assertJsonPath('vehicle_classes.car.per_km_max', 1200); // untouched default kept

        OpenApiContract::assertResponse($response, 'put', '/admin/settings/rides');

        $this->assertSame(10, RideSettings::get()['commission_pct']);
        $log = ActivityLog::where('action', 'ride_settings_updated')->first();
        $this->assertSame($admin->id, $log->admin_id);
        $this->assertSame(8, $log->details['old']['commission_pct']);
        $this->assertSame(10, $log->details['new']['commission_pct']);
    }

    /** @test */
    public function invalid_guardrails_are_rejected()
    {
        $this->as('superadmin');

        $response = $this->putJson('/api/admin/settings/rides', [
            'commission_pct'  => 80,
            'vehicle_classes' => ['car' => ['per_km_min' => 900, 'per_km_max' => 500, 'min_fare_max' => 1000]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['commission_pct', 'vehicle_classes.car.per_km_max']);

        OpenApiContract::assertResponse($response, 'put', '/admin/settings/rides');
    }

    /** @test */
    public function only_superadmin_can_read_or_change_pricing()
    {
        foreach (['admin', 'driver', 'user'] as $role) {
            $this->as($role);
            $this->getJson('/api/admin/settings/rides')->assertStatus(403);
            $this->putJson('/api/admin/settings/rides', ['commission_pct' => 1])->assertStatus(403);
        }
        $this->assertSame(8, RideSettings::get()['commission_pct']);
    }
}
