<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CarRental;
use App\Models\PrivateSeat;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Characterization of generic /bookings create/list for the rental and private
 * types (runbook M01) — locks responses before LegacyBookings extraction.
 */
class LegacyBookingParityTest extends TestCase
{
    use RefreshDatabase;

    private function car(array $overrides = []): CarRental
    {
        return CarRental::create(array_merge([
            'user_id' => $this->makeUser('driver')->id, 'name' => 'RAV4', 'type' => 'SUV', 'price' => 50000,
            'seats' => 5, 'plate' => 'RAD 123 A', 'active' => true,
        ], $overrides));
    }

    private function seat(array $overrides = []): PrivateSeat
    {
        return PrivateSeat::create(array_merge([
            'user_id' => $this->makeUser('driver')->id, 'driver' => 'Eric', 'from' => 'Kigali', 'to' => 'Musanze',
            'pickup_station' => 'Nyabugogo', 'dep' => '08:00', 'price' => 3000, 'seats' => 3, 'active' => true,
        ], $overrides));
    }

    private function tomorrow(): string
    {
        return Carbon::now('Africa/Kigali')->addDay()->toDateString();
    }

    public function test_rental_booking_is_created_from_the_car_with_no_fee(): void
    {
        $me = $this->actingAsRole('user');
        $other = $this->makeUser('user');
        $car = $this->car();

        $response = $this->postJson('/api/bookings', [
            'type' => 'rental', 'reference_id' => $car->id, 'payment_method' => 'Card', 'days' => 2,
            'quantity' => 5, 'service_fee' => 0, 'travel_date' => 'Tomorrow', 'user_id' => $other->id,
        ])->assertCreated();

        $booking = Booking::findOrFail($response->json('id'));
        $response->assertExactJson([
            'id' => $booking->id, 'type' => 'rental', 'title' => 'RAV4 (SUV)', 'sub' => 'RAD 123 A · 2 days',
            'price' => 50000 * 2, 'status' => 'pending',
        ]);
        $this->assertSame($me->id, (int) $booking->user_id);   // never someone else's booking
        $this->assertSame(1, (int) $booking->quantity);        // a rental is one car
        $this->assertSame(0, (int) $booking->service_fee);   // S7.4: no Jali fees
        $this->assertSame($this->tomorrow(), $booking->travel_date);
        $this->assertNull($booking->trip_departure_id);
        $this->assertDatabaseHas('activity_logs', ['action' => 'booking_created', 'entity_id' => $booking->id, 'admin_id' => $me->id]);
    }

    public function test_rental_cannot_be_double_booked_for_the_same_date(): void
    {
        $car = $this->car();
        $this->actingAsRole('user');
        $this->postJson('/api/bookings', ['type' => 'rental', 'reference_id' => $car->id, 'payment_method' => 'Card', 'travel_date' => 'Tomorrow'])
            ->assertCreated();

        $this->actingAsRole('user');
        $this->postJson('/api/bookings', ['type' => 'rental', 'reference_id' => $car->id, 'payment_method' => 'Card', 'travel_date' => 'Tomorrow'])
            ->assertStatus(422)->assertExactJson(['error' => 'Sold out', 'message' => 'Not enough seats left (0 available).']);
        $this->assertSame(1, Booking::where('type', 'rental')->count());
    }

    public function test_inactive_rental_is_not_bookable(): void
    {
        $car = $this->car(['active' => false]);
        $this->actingAsRole('user');

        $this->postJson('/api/bookings', ['type' => 'rental', 'reference_id' => $car->id, 'payment_method' => 'Card'])
            ->assertNotFound()->assertExactJson(['error' => 'Item not found', 'message' => 'This listing is no longer available.']);
    }

    public function test_private_seat_booking_uses_listing_price_and_ignores_client_fee(): void
    {
        $me = $this->actingAsRole('user');
        $seat = $this->seat();

        $response = $this->postJson('/api/bookings', [
            'type' => 'private', 'reference_id' => $seat->id, 'payment_method' => 'MTN MoMo', 'quantity' => 2,
            'service_fee' => 9000, 'travel_date' => 'Tomorrow', 'passenger_names' => ['A', 'B'],
        ])->assertCreated();

        $booking = Booking::findOrFail($response->json('id'));
        $response->assertExactJson([
            'id' => $booking->id, 'type' => 'private', 'title' => 'Eric · Kigali → Musanze', 'sub' => 'Departs 08:00',
            'price' => 3000 * 2, 'status' => 'pending',
        ]);
        $this->assertSame($me->id, (int) $booking->user_id);
        $this->assertSame(2, (int) $booking->quantity);
        $this->assertSame(['A', 'B'], $booking->passenger_names);

        // A client-sent fee is ignored: Jali charges none
        $this->postJson('/api/bookings', [
            'type' => 'private', 'reference_id' => $seat->id, 'payment_method' => 'Card', 'service_fee' => 10, 'travel_date' => 'Tomorrow',
        ])->assertCreated()->assertJsonPath('price', 3000);
    }

    public function test_private_seat_cannot_be_overbooked_or_booked_when_inactive(): void
    {
        $seat = $this->seat(['seats' => 2]);
        $this->actingAsRole('user');

        $this->postJson('/api/bookings', ['type' => 'private', 'reference_id' => $seat->id, 'payment_method' => 'Card', 'quantity' => 3, 'travel_date' => 'Tomorrow'])
            ->assertStatus(422)->assertExactJson(['error' => 'Sold out', 'message' => 'Not enough seats left (2 available).']);

        $seat->update(['active' => false]);
        $this->postJson('/api/bookings', ['type' => 'private', 'reference_id' => $seat->id, 'payment_method' => 'Card'])
            ->assertNotFound();
        $this->assertSame(0, Booking::count());
    }

    public function test_invalid_input_keeps_validation_responses(): void
    {
        $this->actingAsRole('user');

        $this->postJson('/api/bookings', ['type' => 'cargo', 'reference_id' => 1, 'payment_method' => 'Card'])
            ->assertStatus(422)->assertJsonValidationErrors(['type']);
        $this->postJson('/api/bookings', ['type' => 'private', 'reference_id' => $this->seat()->id, 'payment_method' => 'Card', 'travel_date' => 'yesterday-ish'])
            ->assertStatus(422)->assertExactJson(['error' => 'Validation failed', 'message' => 'Invalid or past travel date.']);
    }

    public function test_booking_list_shows_only_the_callers_rental_and_private_bookings(): void
    {
        $car = $this->car();
        $seat = $this->seat();
        $stranger = $this->actingAsRole('user');
        $this->postJson('/api/bookings', ['type' => 'private', 'reference_id' => $seat->id, 'payment_method' => 'Card', 'travel_date' => 'Tomorrow'])->assertCreated();
        $strangerBooking = Booking::where('user_id', $stranger->id)->value('id');

        $this->actingAsRole('user');
        $rental = $this->postJson('/api/bookings', ['type' => 'rental', 'reference_id' => $car->id, 'payment_method' => 'Card', 'travel_date' => 'Tomorrow'])->json('id');
        $private = $this->postJson('/api/bookings', ['type' => 'private', 'reference_id' => $seat->id, 'payment_method' => 'Card', 'travel_date' => 'Tomorrow'])->json('id');

        $list = $this->getJson('/api/bookings')->assertOk()->json();
        $this->assertEqualsCanonicalizing([$rental, $private], array_column($list, 'id'));
        $this->assertSame(
            ['id', 'type', 'title', 'sub', 'price', 'quantity', 'travel_date', 'status', 'ticket_photo_url', 'location_id', 'created_at'],
            array_keys($list[0]),
        );
        $this->assertSame([], $this->getJson('/api/bookings?status=delivered')->assertOk()->json());
        $this->assertCount(2, $this->getJson('/api/bookings?status=pending')->json());

        // Someone else's booking stays private
        $this->getJson("/api/bookings/{$strangerBooking}")->assertForbidden();
        $this->getJson("/api/bookings/{$rental}")->assertOk()->assertJsonPath('type', 'rental');
    }

    public function test_listing_owner_does_not_see_customer_bookings_in_their_own_list(): void
    {
        $owner = $this->makeUser('driver');
        $seat = $this->seat(['user_id' => $owner->id]);
        $this->actingAsRole('user');
        $this->postJson('/api/bookings', ['type' => 'private', 'reference_id' => $seat->id, 'payment_method' => 'Card', 'travel_date' => 'Tomorrow'])->assertCreated();

        $this->actingAs(User::find($owner->id), 'sanctum');
        $this->assertSame([], $this->getJson('/api/bookings')->assertOk()->json());
    }
}
