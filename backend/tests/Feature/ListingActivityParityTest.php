<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\PrivateSeat;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Characterization of GET /driver/stats and GET /driver/trips (private-seat
 * listings only) and the public /private-seats catalogue, before/after M03-Shared.
 */
class ListingActivityParityTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function seat(User $owner, array $overrides = []): PrivateSeat
    {
        return PrivateSeat::create(array_merge([
            'user_id' => $owner->id, 'driver' => $owner->name, 'from' => 'Kigali', 'to' => 'Huye',
            'dep' => '08:00', 'price' => 3000, 'seats' => 4, 'rating' => 4, 'active' => true,
        ], $overrides));
    }

    private function booking(int $referenceId, array $overrides = [], ?string $createdAt = null): Booking
    {
        $booking = Booking::create(array_merge([
            'user_id' => $this->makeUser('user')->id, 'type' => 'private', 'reference_id' => $referenceId,
            'title' => 't', 'sub' => '', 'price' => 3000, 'service_fee' => 500, 'quantity' => 1,
            'status' => 'pending', 'payment_method' => 'Card',
        ], $overrides));
        if ($createdAt) {
            Booking::whereKey($booking->id)->update(['created_at' => $createdAt]);
        }
        return $booking->fresh();
    }

    public function test_stats_count_own_private_bookings_today_and_this_week(): void
    {
        Carbon::setTestNow('2026-10-07 12:00:00'); // Wednesday; week starts Monday 5 Oct
        $driver = $this->actingAsRole('driver');
        $a = $this->seat($driver, ['rating' => 4]);
        $b = $this->seat($driver, ['rating' => 5]);
        $foreign = $this->seat($this->makeUser('driver'));

        $this->booking($a->id, ['price' => 6000, 'quantity' => 2]);                       // today
        $this->booking($b->id, ['price' => 3000], '2026-10-05 09:00:00');                 // this week
        $this->booking($a->id, ['price' => 9999], '2026-10-04 09:00:00');                 // last week
        $this->booking($a->id, ['price' => 7777, 'status' => 'cancelled']);              // cancelled
        $this->booking($a->id, ['type' => 'rental', 'price' => 5555]);                    // other type, same id
        $this->booking($foreign->id, ['price' => 4444]);                                  // someone else's listing

        $this->getJson('/api/driver/stats')->assertOk()->assertExactJson([
            'todayEarnings' => 6000, 'todayTrips' => 1, 'rating' => 4.5, 'weekEarnings' => 9000, 'weekTrips' => 2,
        ]);
    }

    public function test_stats_and_trips_for_a_driver_without_listings_are_empty(): void
    {
        $this->actingAsRole('driver');
        $other = $this->seat($this->makeUser('driver'));
        $this->booking($other->id);

        $this->getJson('/api/driver/stats')->assertOk()->assertExactJson([
            'todayEarnings' => 0, 'todayTrips' => 0, 'rating' => 0, 'weekEarnings' => 0, 'weekTrips' => 0,
        ]);
        $this->getJson('/api/driver/trips')->assertOk()->assertExactJson([]);
    }

    public function test_trips_shape_order_and_status_mapping(): void
    {
        Carbon::setTestNow('2026-10-07 12:00:00');
        $driver = $this->actingAsRole('driver');
        $seat = $this->seat($driver, ['from' => 'Kigali', 'to' => 'Rubavu', 'dep' => '06:30']);

        $old = $this->booking($seat->id, ['status' => 'cancelled', 'quantity' => 3, 'price' => 9000], '2026-10-01 08:00:00');
        $new = $this->booking($seat->id, ['status' => 'ticket_ready', 'travel_date' => '2026-10-09']);
        $this->booking($this->seat($this->makeUser('driver'))->id);

        $this->getJson('/api/driver/trips')->assertOk()->assertExactJson([
            ['id' => $new->id, 'from' => 'Kigali', 'to' => 'Rubavu', 'dep' => '06:30', 'date' => '2026-10-09', 'pax' => 1, 'earning' => 3000, 'status' => 'upcoming'],
            ['id' => $old->id, 'from' => 'Kigali', 'to' => 'Rubavu', 'dep' => '06:30', 'date' => '2026-10-01', 'pax' => 3, 'earning' => 9000, 'status' => 'cancelled'],
        ]);
    }

    public function test_private_catalogue_filters_orders_and_paginates(): void
    {
        $owner = $this->makeUser('driver');
        $late    = $this->seat($owner, ['dep' => '15:00', 'date' => null]);
        $early   = $this->seat($owner, ['dep' => '07:00', 'date' => '2026-10-09']);
        $this->seat($owner, ['dep' => '09:00', 'date' => '2026-10-10']);
        $this->seat($owner, ['dep' => '10:00', 'to' => 'Musanze']);
        $this->seat($owner, ['dep' => '11:00', 'active' => false]);
        $this->seat($owner, ['dep' => '12:00', 'seats' => 0]);
        $this->actingAsRole('user');

        $page = $this->getJson('/api/private-seats?from=Kigali&to=Huye&date=2026-10-09')->assertOk();
        $this->assertSame([$early->id, $late->id], array_column($page->json('data'), 'id'));
        $page->assertJsonPath('total', 2)->assertJsonPath('per_page', 10)->assertJsonPath('current_page', 1);

        $this->assertSame(4, $this->getJson('/api/private-seats')->json('total'));
        $this->assertSame(4, $this->getJson('/api/private-seats?date=not-a-date')->json('total')); // unparseable date is ignored
        $this->assertSame(1, $this->getJson('/api/private-seats?to=Musanze')->json('total'));
    }
}
