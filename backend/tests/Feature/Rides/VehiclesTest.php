<?php

namespace Tests\Feature\Rides;

use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

class VehiclesTest extends TestCase
{
    use RefreshDatabase;

    private User $applicant;

    private array $car = [
        'class' => 'car', 'body_type' => 'SUV', 'make' => 'Toyota', 'model' => 'RAV4', 'color' => 'White',
        'year' => 2019, 'plate' => 'rab 123 a', 'seats' => 4, 'amenities' => ['AC'], 'insurance_expiry' => '2027-06-30',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        // A regular rider applying to drive
        $this->applicant = $this->user('user');
    }

    private function user(string $role): User
    {
        return User::create(['name' => $role, 'role_id' => Role::where('name', $role)->value('id')]);
    }

    /** @test */
    public function rider_can_register_a_vehicle_and_the_first_one_is_active()
    {
        Sanctum::actingAs($this->applicant);

        $response = $this->postJson('/api/driver/vehicles', $this->car)
            ->assertCreated()
            ->assertJsonPath('plate', 'RAB 123 A')
            ->assertJsonPath('is_active', true)
            ->assertJsonPath('class', 'car');
        OpenApiContract::assertResponse($response, 'post', '/driver/vehicles');

        $second = $this->postJson('/api/driver/vehicles', ['plate' => 'RAC 456B', 'model' => 'Corolla'] + $this->car)
            ->assertCreated()->assertJsonPath('is_active', false);

        OpenApiContract::assertResponse($this->getJson('/api/driver/vehicles')->assertJsonCount(2), 'get', '/driver/vehicles');

        // Switch active vehicle — only one stays active
        $this->postJson("/api/driver/vehicles/{$second['id']}/activate")->assertOk()->assertJsonPath('is_active', true);
        $this->assertSame(1, Vehicle::where('is_active', true)->count());
        $this->assertSame($second['id'], Vehicle::where('is_active', true)->value('id'));
    }

    /** @test */
    public function plate_must_be_unique_across_jali()
    {
        $other = $this->user('driver');
        $other->vehicles()->create(['model' => 'X', 'plate' => 'RAB 123 A']);
        Sanctum::actingAs($this->applicant);

        $response = $this->postJson('/api/driver/vehicles', $this->car)->assertStatus(422)->assertJsonValidationErrors(['plate']);
        OpenApiContract::assertResponse($response, 'post', '/driver/vehicles');
    }

    /** @test */
    public function class_insurance_and_seats_are_validated()
    {
        Sanctum::actingAs($this->applicant);

        $this->postJson('/api/driver/vehicles', ['class' => 'bus', 'insurance_expiry' => 'next year'] + $this->car)
            ->assertStatus(422)->assertJsonValidationErrors(['class', 'insurance_expiry']);

        $this->postJson('/api/driver/vehicles', ['class' => 'moto', 'seats' => 4, 'plate' => 'RD 123 M'] + $this->car)
            ->assertStatus(422)->assertJsonValidationErrors(['seats']);

        $this->postJson('/api/driver/vehicles', array_diff_key($this->car, ['insurance_expiry' => 1]))
            ->assertStatus(422)->assertJsonValidationErrors(['insurance_expiry']);
    }

    /** @test */
    public function driver_can_edit_and_delete_only_own_vehicles()
    {
        $other = $this->user('driver');
        $theirs = $other->vehicles()->create(['model' => 'X', 'plate' => 'RAZ 999Z']);
        Sanctum::actingAs($this->applicant);
        $mine = $this->postJson('/api/driver/vehicles', $this->car)->json();

        OpenApiContract::assertResponse(
            $this->patchJson("/api/driver/vehicles/{$mine['id']}", ['color' => 'Black', 'plate' => 'RAB 123 A'])
                ->assertOk()->assertJsonPath('color', 'Black'),
            'patch', '/driver/vehicles/{id}');

        OpenApiContract::assertResponse(
            $this->patchJson("/api/driver/vehicles/{$theirs->id}", ['color' => 'Red'])->assertNotFound(),
            'patch', '/driver/vehicles/{id}');
        $this->deleteJson("/api/driver/vehicles/{$theirs->id}")->assertNotFound();
        $this->postJson("/api/driver/vehicles/{$theirs->id}/activate")->assertNotFound();

        OpenApiContract::assertResponse(
            $this->deleteJson("/api/driver/vehicles/{$mine['id']}")->assertOk(), 'delete', '/driver/vehicles/{id}');
        $this->assertNull(Vehicle::find($mine['id']));
        $this->assertNotNull($theirs->fresh());
    }

    /** @test */
    public function photos_are_uploaded_per_slot_and_replaced()
    {
        Storage::fake('public');
        Sanctum::actingAs($this->applicant);
        $vehicle = $this->postJson('/api/driver/vehicles', $this->car)->json();

        $first = $this->post("/api/driver/vehicles/{$vehicle['id']}/photos",
            ['slot' => 'front', 'photo' => UploadedFile::fake()->image('front.jpg')], ['Accept' => 'application/json'])
            ->assertOk();
        OpenApiContract::assertResponse($first, 'post', '/driver/vehicles/{id}/photos');
        $firstUrl = $first->json('photos.front');
        $this->assertNotNull($firstUrl);

        $second = $this->post("/api/driver/vehicles/{$vehicle['id']}/photos",
            ['slot' => 'front', 'photo' => UploadedFile::fake()->image('front2.jpg')], ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertNotSame($firstUrl, $second->json('photos.front'));
        $this->assertCount(1, Storage::disk('public')->allFiles("vehicles/{$vehicle['id']}"));

        $this->post("/api/driver/vehicles/{$vehicle['id']}/photos",
            ['slot' => 'roof', 'photo' => UploadedFile::fake()->create('x.pdf', 10)], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['slot', 'photo']);
    }

    /** @test */
    public function vehicles_require_sign_in()
    {
        $this->getJson('/api/driver/vehicles')->assertStatus(401);
        $this->postJson('/api/driver/vehicles', $this->car)->assertStatus(401);
    }
}
