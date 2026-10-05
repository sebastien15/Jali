<?php

namespace Tests\Feature\Rides;

use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DriverProfileTest extends TestCase
{
    use RefreshDatabase;

    private User $driver;

    /** What driver/setup.tsx sends */
    private array $setupPayload = [
        'name'             => 'Jean Driver',
        'car_model'        => 'Toyota RAV4',
        'plate'            => ' rab  123a ',
        'seats'            => 4,
        'car_type'         => 'SUV',
        'price_day'        => 65000,
        'caution'          => 50000,
        'insurance_expiry' => '2027-03-31',
        'allowed_zones'    => ['Kigali CBD', 'Remera'],
        'docs_url'         => 'https://firebasestorage.googleapis.com/doc.pdf',
        'amenities'        => ['AC', 'WiFi'],
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->driver = $this->makeUser('driver');
    }

    private function makeUser(string $role): User
    {
        return User::create([
            'name'    => ucfirst($role),
            'role_id' => Role::where('name', $role)->value('id'),
        ]);
    }

    /** @test */
    public function setup_data_is_saved_and_returned_on_reload()
    {
        Sanctum::actingAs($this->driver);

        $this->patchJson('/api/driver/profile', $this->setupPayload)->assertOk();

        $this->getJson('/api/driver/profile')
            ->assertOk()
            ->assertJsonPath('user.name', 'Jean Driver')
            ->assertJsonPath('profile.allowed_zones', ['Kigali CBD', 'Remera'])
            ->assertJsonPath('profile.docs_url', 'https://firebasestorage.googleapis.com/doc.pdf')
            ->assertJsonPath('profile.verification_status', 'pending')
            ->assertJsonPath('vehicle.model', 'Toyota RAV4')
            ->assertJsonPath('vehicle.plate', 'RAB 123A')
            ->assertJsonPath('vehicle.seats', 4)
            ->assertJsonPath('vehicle.body_type', 'SUV')
            ->assertJsonPath('vehicle.class', 'car')
            ->assertJsonPath('vehicle.insurance_expiry', '2027-03-31')
            ->assertJsonPath('vehicle.rental_price_day', 65000)
            ->assertJsonPath('vehicle.rental_caution', 50000)
            ->assertJsonPath('vehicle.amenities', ['AC', 'WiFi'])
            ->assertJsonCount(1, 'vehicles');
    }

    /** @test */
    public function saving_again_updates_the_same_vehicle()
    {
        Sanctum::actingAs($this->driver);

        $this->patchJson('/api/driver/profile', $this->setupPayload)->assertOk();
        $this->patchJson('/api/driver/profile', ['seats' => 7, 'car_type' => 'Minivan', 'plate' => 'RAB 123A'])
            ->assertOk()
            ->assertJsonPath('vehicle.seats', 7)
            ->assertJsonPath('vehicle.class', 'van');

        $this->assertSame(1, Vehicle::count());
    }

    /** @test */
    public function duplicate_plate_is_rejected_with_a_field_error()
    {
        $other = $this->makeUser('driver');
        $other->vehicles()->create(['model' => 'Corolla', 'plate' => 'RAB 123A']);

        Sanctum::actingAs($this->driver);

        $this->patchJson('/api/driver/profile', $this->setupPayload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['plate']);
    }

    /** @test */
    public function invalid_insurance_date_is_rejected_with_a_field_error()
    {
        Sanctum::actingAs($this->driver);

        $this->patchJson('/api/driver/profile', ['insurance_expiry' => 'Dec 2025'] + $this->setupPayload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['insurance_expiry']);
    }

    /** @test */
    public function model_is_required_when_creating_a_vehicle_with_a_plate()
    {
        Sanctum::actingAs($this->driver);

        $this->patchJson('/api/driver/profile', ['plate' => 'RAC 999B'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['car_model']);
    }

    /** @test */
    public function name_and_fcm_token_only_updates_still_work()
    {
        Sanctum::actingAs($this->driver);

        $this->patchJson('/api/driver/profile', ['name' => 'New Name', 'fcm_token' => 'tok'])
            ->assertOk()
            ->assertJsonPath('user.name', 'New Name')
            ->assertJsonPath('vehicle', null);

        $this->assertSame('tok', $this->driver->fresh()->fcm_token);
    }

    /** @test */
    public function profile_requires_driver_permission_and_auth()
    {
        $this->getJson('/api/driver/profile')->assertStatus(401);

        Sanctum::actingAs($this->makeUser('user'));
        $this->getJson('/api/driver/profile')->assertStatus(403);
        $this->patchJson('/api/driver/profile', $this->setupPayload)->assertStatus(403);
    }
}
