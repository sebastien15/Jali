<?php

namespace Tests\Feature\Rides;

use App\Models\Role;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RidePermissionsTest extends TestCase
{
    use RefreshDatabase;

    private const MATRIX = [
        'request-rides'       => ['superadmin' => true, 'admin' => true,  'user' => true,  'driver' => true],
        'offer-rides'         => ['superadmin' => true, 'admin' => false, 'user' => false, 'driver' => true],
        'offer-driver-hire'   => ['superadmin' => true, 'admin' => false, 'user' => false, 'driver' => true],
        'verify-drivers'      => ['superadmin' => true, 'admin' => true,  'user' => false, 'driver' => false],
        'manage-rides'        => ['superadmin' => true, 'admin' => true,  'user' => false, 'driver' => false],
        'manage-ride-pricing' => ['superadmin' => true, 'admin' => false, 'user' => false, 'driver' => false],
        'apply-as-driver'     => ['superadmin' => true, 'admin' => true,  'user' => true,  'driver' => true],
    ];

    /** @test */
    public function seeded_roles_match_the_ride_permission_matrix()
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->assertMatrix();
    }

    /** @test */
    public function ride_permissions_are_in_the_rides_category()
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        foreach (array_keys(self::MATRIX) as $name) {
            $this->assertDatabaseHas('permissions', ['name' => $name, 'category' => 'Rides']);
        }
    }

    /** @test */
    public function migration_assigns_ride_permissions_to_existing_roles()
    {
        // Simulate a production database: roles exist before the ride migration runs
        foreach (['superadmin', 'admin', 'user', 'driver'] as $name) {
            Role::firstOrCreate(['name' => $name]);
        }
        foreach (['2026_10_05_000001_add_ride_permissions', '2026_10_05_000005_add_apply_as_driver_permission'] as $file) {
            (require database_path("migrations/$file.php"))->up();
        }

        $this->assertMatrix();
    }

    private function assertMatrix(): void
    {
        foreach (self::MATRIX as $permission => $roles) {
            foreach ($roles as $roleName => $expected) {
                $has = Role::where('name', $roleName)->first()
                    ->permissions()->where('name', $permission)->exists();
                $this->assertSame($expected, $has, "$roleName / $permission");
            }
        }
    }
}
