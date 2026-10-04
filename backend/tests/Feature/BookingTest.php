<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CarRental;
use App\Models\TripDeparture;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use RefreshDatabase;

    private TripDeparture $departure;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->departure = TripDeparture::with('route')->first();
    }

    private function bookTrip(array $overrides = [])
    {
        return $this->postJson('/api/bookings', array_merge([
            'type' => 'trip',
            'reference_id' => $this->departure->id,
            'payment_method' => 'MTN MoMo',
            'travel_date' => 'Tomorrow',
        ], $overrides));
    }

    public function test_price_and_fee_are_computed_server_side(): void
    {
        $this->actingAsRole('user');
        $unit = $this->departure->route->price;

        $this->bookTrip(['price' => 1, 'service_fee' => 0, 'quantity' => 3])->assertCreated();

        $booking = Booking::latest('id')->first();
        $this->assertSame($unit * 3, (int) $booking->price);
        $this->assertSame(max(500, min(3000, (int) round($unit * 0.05))), (int) $booking->service_fee);
        $this->assertSame(3, (int) $booking->quantity);
    }

    public function test_trip_booking_keeps_its_departure_and_location(): void
    {
        $this->actingAsRole('user');

        $this->bookTrip()->assertCreated();

        $booking = Booking::latest('id')->first();
        $this->assertSame($this->departure->id, (int) $booking->trip_departure_id);
        $this->assertNotNull($booking->location_id);
    }

    public function test_client_title_and_location_are_ignored(): void
    {
        $this->actingAsRole('user');

        $this->bookTrip(['title' => 'Free ride', 'location_id' => 999])->assertCreated();

        $booking = Booking::latest('id')->first();
        $this->assertStringNotContainsString('Free ride', $booking->title);
        $this->assertNotSame(999, (int) $booking->location_id);
    }

    public function test_rental_price_is_daily_rate_times_days(): void
    {
        $this->actingAsRole('user');
        $car = CarRental::where('active', true)->first();

        $this->postJson('/api/bookings', [
            'type' => 'rental', 'reference_id' => $car->id, 'payment_method' => 'Card', 'days' => 3, 'price' => 1, 'travel_date' => 'Tomorrow',
        ])->assertCreated();

        $this->assertSame($car->price * 3, (int) Booking::latest('id')->first()->price);
    }

    public function test_booking_a_missing_item_fails_even_with_a_title(): void
    {
        $this->actingAsRole('user');

        $this->bookTrip(['reference_id' => 999999, 'title' => 'Fake'])->assertNotFound();
        $this->assertSame(0, Booking::where('reference_id', 999999)->count());
    }

    public function test_inactive_departure_cannot_be_booked(): void
    {
        $this->actingAsRole('user');
        $this->departure->update(['active' => false]);

        $this->bookTrip()->assertNotFound();
    }

    public function test_departure_cannot_be_overbooked(): void
    {
        $this->actingAsRole('user');
        $this->departure->route->update(['total_seats' => 4]);

        $this->bookTrip(['quantity' => 3])->assertCreated();
        $this->bookTrip(['quantity' => 2])->assertStatus(422);
        $this->bookTrip(['quantity' => 1])->assertCreated();
        // a different day has its own seats
        $this->bookTrip(['quantity' => 4, 'travel_date' => Carbon::now('Africa/Kigali')->addDays(3)->toDateString()])->assertCreated();
    }

    public function test_travel_date_labels_are_stored_as_real_dates(): void
    {
        $this->actingAsRole('user');

        $this->bookTrip(['travel_date' => 'Tomorrow · 14:00'])->assertCreated();

        $this->assertSame(
            Carbon::now('Africa/Kigali')->addDay()->toDateString(),
            Booking::latest('id')->first()->travel_date,
        );
    }

    public function test_past_travel_date_is_rejected(): void
    {
        $this->actingAsRole('user');

        $this->bookTrip(['travel_date' => Carbon::now('Africa/Kigali')->subDay()->toDateString()])->assertStatus(422);
    }

    public function test_unknown_payment_method_is_rejected(): void
    {
        $this->actingAsRole('user');

        $this->bookTrip(['payment_method' => 'Free'])->assertStatus(422);
    }

    public function test_user_sees_only_own_bookings(): void
    {
        $me = $this->actingAsRole('user');
        $this->bookTrip()->assertCreated();

        $ids = collect($this->getJson('/api/bookings')->assertOk()->json())->pluck('id');

        $this->assertSame(Booking::where('user_id', $me->id)->pluck('id')->sort()->values()->all(), $ids->sort()->values()->all());
    }

    public function test_user_cannot_view_someone_elses_booking(): void
    {
        $other = Booking::where('type', 'trip')->first();
        $this->actingAsRole('user');

        $this->getJson("/api/bookings/{$other->id}")->assertForbidden();
    }
}
