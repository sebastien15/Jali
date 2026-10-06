<?php

namespace Tests\Feature;

use App\Models\CarRental;
use App\Models\PrivateSeat;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Characterization of owner CRUD for rental cars (/driver/cars) and private
 * seat listings (/driver/listings) — runbook M01, before M03 moves.
 */
class OwnerListingsParityTest extends TestCase
{
    use RefreshDatabase;

    private function carPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Corolla', 'type' => 'Sedan', 'plate' => 'RAB 001 C', 'seats' => 4, 'priceDay' => 40000,
            'caution' => 100000, 'amenities' => ['AC'],
        ], $overrides);
    }

    public function test_owner_creates_lists_updates_and_deletes_own_car(): void
    {
        $driver = $this->actingAsRole('driver');
        $other = CarRental::create(['user_id' => $this->makeUser('driver')->id, 'name' => 'X', 'type' => 'SUV', 'price' => 1, 'seats' => 5, 'plate' => 'P', 'active' => true]);

        $created = $this->postJson('/api/driver/cars', $this->carPayload())->assertCreated()
            ->assertJsonPath('priceDay', 40000)->assertJsonPath('price', 40000)
            ->assertJsonPath('user_id', $driver->id)->assertJsonPath('active', true);
        $id = $created->json('id');

        $this->assertSame([$id], array_column($this->getJson('/api/driver/cars')->assertOk()->json(), 'id'));

        $this->patchJson("/api/driver/cars/{$id}", ['priceDay' => 45000, 'status' => 'rented'])->assertOk()
            ->assertJsonPath('priceDay', 45000)->assertJsonPath('price', 45000)->assertJsonPath('status', 'rented');
        $this->assertSame(45000, (int) CarRental::find($id)->price);

        $this->deleteJson("/api/driver/cars/{$id}")->assertNoContent();
        $this->assertNull(CarRental::find($id));
        $this->assertNotNull(CarRental::find($other->id));
    }

    public function test_owner_cannot_update_or_delete_another_drivers_car(): void
    {
        $car = CarRental::create(['user_id' => $this->makeUser('driver')->id, 'name' => 'RAV4', 'type' => 'SUV', 'price' => 50000, 'seats' => 5, 'plate' => 'RAD1', 'active' => true]);
        $this->actingAsRole('driver');

        $this->patchJson("/api/driver/cars/{$car->id}", ['priceDay' => 1])->assertNotFound();
        $this->deleteJson("/api/driver/cars/{$car->id}")->assertNotFound();
        $this->assertSame([], $this->getJson('/api/driver/cars')->assertOk()->json());
        $this->assertSame(50000, (int) $car->fresh()->price);
    }

    public function test_car_validation_and_customer_access(): void
    {
        $this->actingAsRole('driver');
        $this->postJson('/api/driver/cars', $this->carPayload(['type' => 'Boat']))->assertStatus(422)->assertJsonValidationErrors(['type']);

        $this->actingAsRole('user');
        $this->postJson('/api/driver/cars', $this->carPayload())->assertForbidden();
    }

    public function test_owner_lists_updates_and_deletes_own_private_listing(): void
    {
        $driver = $this->actingAsRole('driver');
        PrivateSeat::create(['user_id' => $this->makeUser('driver')->id, 'driver' => 'x', 'from' => 'A', 'to' => 'B', 'dep' => '07:00', 'price' => 1, 'seats' => 1, 'active' => true]);

        $id = $this->postJson('/api/driver/listings', [
            'from' => 'Kigali', 'to' => 'Huye', 'pickup_station' => 'Nyabugogo', 'dep' => '09:00', 'price' => 4000, 'seats' => 3,
        ])->assertCreated()->assertJsonPath('driver', $driver->name)->assertJsonPath('user_id', $driver->id)->json('id');

        $this->assertSame([$id], array_column($this->getJson('/api/driver/listings')->assertOk()->json(), 'id'));

        $this->patchJson("/api/driver/listings/{$id}", ['price' => 4500, 'active' => false, 'date' => 'Tomorrow'])->assertOk()
            ->assertJsonPath('price', 4500)->assertJsonPath('active', false);
        $this->patchJson("/api/driver/listings/{$id}", ['date' => 'not a date'])->assertStatus(422)
            ->assertExactJson(['message' => 'Invalid date.', 'errors' => ['date' => ['Invalid date.']]]);

        $this->deleteJson("/api/driver/listings/{$id}")->assertNoContent();
        $this->assertNull(PrivateSeat::find($id));
    }
}
