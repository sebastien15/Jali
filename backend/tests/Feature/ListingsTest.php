<?php

namespace Tests\Feature;

use App\Models\CarRental;
use App\Models\PrivateSeat;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ListingsTest extends TestCase
{
    use RefreshDatabase;

    private function listing(array $overrides = []): array
    {
        return array_merge([
            'from' => 'Kigali', 'to' => 'Musanze', 'pickup_station' => 'Nyabugogo', 'dep' => '08:00',
            'price' => 3000, 'seats' => 4, 'notes' => 'Bring ID',
        ], $overrides);
    }

    public function test_listing_date_label_is_normalised_and_searchable(): void
    {
        $this->actingAsRole('driver');
        $label = Carbon::now('Africa/Kigali')->addDays(2)->format('D j M Y'); // e.g. "Wed 7 Oct 2026"

        $this->postJson('/api/driver/listings', $this->listing(['date' => $label]))->assertCreated();

        $seat = PrivateSeat::latest('id')->first();
        $this->assertSame(Carbon::now('Africa/Kigali')->addDays(2)->toDateString(), $seat->date);
        $this->assertSame('Bring ID', $seat->notes);

        $this->actingAsRole('user');
        $this->getJson('/api/private-seats?date=' . $seat->date . '&from=')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/private-seats?date=Tomorrow')->assertOk()->assertJsonPath('total', 0);
    }

    public function test_invalid_listing_date_is_rejected(): void
    {
        $this->actingAsRole('driver');

        $this->postJson('/api/driver/listings', $this->listing(['date' => 'next blue moon']))->assertStatus(422);
    }

    public function test_driver_cannot_edit_someone_elses_listing(): void
    {
        $owner = $this->makeUser('driver');
        $seat = PrivateSeat::create(array_merge($this->listing(), ['user_id' => $owner->id, 'driver' => 'x', 'active' => true]));
        $this->actingAsRole('driver');

        $this->patchJson("/api/driver/listings/{$seat->id}", ['price' => 1])->assertNotFound();
        $this->deleteJson("/api/driver/listings/{$seat->id}")->assertNotFound();
    }

    public function test_car_status_is_saved_and_unavailable_cars_are_hidden_and_unbookable(): void
    {
        $driver = $this->actingAsRole('driver');
        $car = CarRental::create(['user_id' => $driver->id, 'name' => 'RAV4', 'type' => 'SUV', 'price' => 50000, 'seats' => 5, 'plate' => 'RAD1', 'active' => true]);

        $this->patchJson("/api/driver/cars/{$car->id}", ['status' => 'maintenance', 'notes' => 'brakes'])->assertOk()
            ->assertJsonPath('status', 'maintenance')->assertJsonPath('notes', 'brakes');

        $this->actingAsRole('user');
        $this->assertNotContains($car->id, collect($this->getJson('/api/car-rentals')->json())->pluck('id'));
        $this->postJson('/api/bookings', ['type' => 'rental', 'reference_id' => $car->id, 'payment_method' => 'Card'])->assertNotFound();
    }
}
