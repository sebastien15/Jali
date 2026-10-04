<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\PrivateSeat;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverTest extends TestCase
{
    use RefreshDatabase;

    private function listingWithBooking(User $driver, string $status, int $qty = 1): PrivateSeat
    {
        $seat = PrivateSeat::create([
            'user_id' => $driver->id, 'driver' => $driver->name, 'from' => 'Kigali', 'to' => 'Musanze',
            'dep' => '08:00', 'price' => 3000, 'seats' => 4, 'rating' => 4.5, 'active' => true,
        ]);
        Booking::create([
            'user_id' => $this->makeUser('user')->id, 'type' => 'private', 'reference_id' => $seat->id,
            'title' => 't', 'sub' => '', 'price' => 3000 * $qty, 'service_fee' => 500, 'quantity' => $qty,
            'status' => $status, 'payment_method' => 'Card',
        ]);
        return $seat;
    }

    public function test_earnings_are_the_fare_not_fare_minus_fee(): void
    {
        $driver = $this->actingAsRole('driver');
        $this->listingWithBooking($driver, 'pending', 2);

        $this->getJson('/api/driver/stats')->assertOk()->assertJsonPath('todayEarnings', 6000);
        $this->getJson('/api/driver/trips')->assertOk()
            ->assertJsonPath('0.earning', 6000)
            ->assertJsonPath('0.pax', 2)
            ->assertJsonPath('0.status', 'upcoming');
    }

    public function test_delivered_trips_go_to_history(): void
    {
        $driver = $this->actingAsRole('driver');
        $this->listingWithBooking($driver, 'delivered');

        $this->getJson('/api/driver/trips')->assertOk()->assertJsonPath('0.status', 'completed');
    }

    public function test_driver_profile_details_are_saved_and_returned(): void
    {
        $this->actingAsRole('driver');

        $this->patchJson('/api/driver/profile', [
            'name' => 'Joseph', 'car_model' => 'Toyota Hiace', 'plate' => 'RAD 123A', 'seats' => 14,
            'allowed_zones' => ['Kigali'], 'amenities' => ['ac'],
        ])->assertOk();

        $this->getJson('/api/driver/profile')->assertOk()
            ->assertJsonPath('name', 'Joseph')
            ->assertJsonPath('profile.plate', 'RAD 123A')
            ->assertJsonPath('profile.seats', 14);
    }

    public function test_driver_profile_cannot_change_role(): void
    {
        $driver = $this->actingAsRole('driver');

        $this->patchJson('/api/driver/profile', ['role_id' => 1, 'name' => 'x'])->assertOk();
        $this->assertTrue($driver->fresh()->isDriver());
    }

    public function test_passenger_cannot_use_driver_endpoints(): void
    {
        $this->actingAsRole('user');

        $this->getJson('/api/driver/stats')->assertForbidden();
    }
}
