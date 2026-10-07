<?php

namespace Tests\Feature\SharedJourneys;

use App\Models\Booking;
use App\Models\PrivateSeat;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** S25.3: find journeys that pass through my origin before my destination. */
class JourneySearchTest extends TestCase
{
    use RefreshDatabase;

    private string $date;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-12 06:00', 'Africa/Kigali')->utc());
        $this->date = '2026-10-13';
    }

    private function journey(array $stops, int $seats = 3, ?string $date = null): int
    {
        $this->actingAsRole('driver');

        return $this->postJson('/api/driver/listings', ['stops' => $stops, 'seats' => $seats, 'date' => $date ?? $this->date])->assertCreated()->json('id');
    }

    private function kigaliHuye(string $start = '07:00'): int
    {
        return $this->journey([
            ['name' => 'Kigali', 'time' => $start, 'fare_to_next' => 2000],
            ['name' => 'Muhanga', 'time' => '08:00', 'fare_to_next' => 1500],
            ['name' => 'Huye', 'time' => '09:30'],
        ]);
    }

    public function test_partial_routes_match_with_the_segment_fare_and_order_matters(): void
    {
        $late = $this->kigaliHuye('07:30');
        $early = $this->kigaliHuye('06:30');
        $this->actingAsRole('user');

        $res = $this->getJson("/api/journeys/search?from=muhanga&to=Huye&date={$this->date}")->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('data.0.fare', 1500)
            ->assertJsonPath('data.0.from.name', 'Muhanga')->assertJsonPath('data.0.from.time', '08:00')
            ->assertJsonPath('data.0.pickup_point', 'Muhanga')->assertJsonPath('data.0.seats_left', 3);
        OpenApiContract::assertResponse($res, 'get', '/journeys/search');
        $this->getJson("/api/journeys/search?from=Kigali&to=Muhanga&date={$this->date}")
            ->assertJsonPath('data.0.listing_id', $early)->assertJsonPath('data.1.listing_id', $late)->assertJsonPath('data.0.fare', 2000);
        $this->getJson("/api/journeys/search?from=Huye&to=Kigali&date={$this->date}")->assertJsonCount(0, 'data');   // wrong direction

        $detail = $this->getJson("/api/journeys/$early?date={$this->date}")->assertOk()->assertJsonCount(3, 'stops')
            ->assertJsonPath('seats_left_per_segment', [3, 3]);
        OpenApiContract::assertResponse($detail, 'get', '/journeys/{id}');
        $this->getJson("/api/journeys/$early?date=2026-10-20")->assertNotFound();
    }

    public function test_plain_listings_full_seats_and_nearby_dates(): void
    {
        $this->actingAsRole('driver');
        $plain = PrivateSeat::create(['user_id' => null, 'driver' => 'Eric', 'from' => 'Kigali', 'to' => 'Musanze', 'pickup_station' => 'Nyabugogo',
            'dep' => '08:00', 'date' => '2026-10-15', 'price' => 3000, 'seats' => 1, 'active' => true]);
        $this->actingAsRole('user');

        $empty = $this->getJson("/api/journeys/search?from=Kigali&to=Musanze&date={$this->date}")->assertOk()
            ->assertJsonCount(0, 'data')->assertJsonPath('nearby_dates.0.date', '2026-10-15');
        OpenApiContract::assertResponse($empty, 'get', '/journeys/search');
        $this->getJson('/api/journeys/search?from=Kigali&to=Musanze&date=2026-10-15')->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.fare', 3000)->assertJsonPath('data.0.pickup_point', 'Nyabugogo');

        // The only seat taken by a legacy whole-route booking → not offered
        Booking::create(['user_id' => auth()->id(), 'type' => 'private', 'reference_id' => $plain->id, 'title' => 'x', 'sub' => 'y', 'price' => 3000,
            'service_fee' => 0, 'payment_method' => 'Card', 'status' => 'pending', 'quantity' => 1, 'travel_date' => '2026-10-15']);
        $this->getJson('/api/journeys/search?from=Kigali&to=Musanze&date=2026-10-15')->assertJsonCount(0, 'data');
        $this->getJson("/api/journeys/search?from=Kigali&to=Kigali&date={$this->date}")->assertStatus(422);
    }
}
