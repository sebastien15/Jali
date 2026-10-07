<?php

namespace Tests\Feature\SharedJourneys;

use App\Models\PrivateSeat;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** S25.1: a journey with ordered stops, times and segment fares. */
class JourneyStopsTest extends TestCase
{
    use RefreshDatabase;

    private function stops(): array
    {
        return [
            ['name' => 'Kigali', 'time' => '07:00', 'fare_to_next' => 2000],
            ['name' => 'Muhanga', 'time' => '08:00', 'fare_to_next' => 1500],
            ['name' => 'Huye', 'time' => '09:30'],
        ];
    }

    public function test_driver_publishes_a_journey_with_stops_and_the_route_is_derived(): void
    {
        $driver = $this->actingAsRole('driver');
        $res = $this->postJson('/api/driver/listings', ['stops' => $this->stops(), 'seats' => 3, 'date' => 'Tomorrow'])
            ->assertCreated()
            ->assertJsonPath('from', 'Kigali')->assertJsonPath('to', 'Huye')->assertJsonPath('dep', '07:00')
            ->assertJsonPath('price', 3500)->assertJsonCount(3, 'stops')->assertJsonPath('stops.1.name', 'Muhanga');
        $listing = PrivateSeat::with('stops')->find($res->json('id'));
        $this->assertSame(1500, $listing->segmentFare(1, 2));
        $this->assertSame(3500, $listing->segmentFare(0, 2));
        $this->assertSame($driver->id, (int) $listing->user_id);

        // Editing the stops replaces them; old clients still see from/to/price
        $this->patchJson("/api/driver/listings/{$listing->id}", ['stops' => [
            ['name' => 'Kigali', 'time' => '07:00', 'fare_to_next' => 4000], ['name' => 'Huye', 'time' => '09:30'],
        ]])->assertOk()->assertJsonCount(2, 'stops')->assertJsonPath('price', 4000);
        $this->getJson('/api/private-seats?from=Kigali')->assertOk()->assertJsonPath('data.0.stops.1.name', 'Huye');
    }

    public function test_stops_must_be_in_time_order_and_priced(): void
    {
        $this->actingAsRole('driver');
        $late = $this->stops();
        $late[1]['time'] = '06:00';
        $this->postJson('/api/driver/listings', ['stops' => $late, 'seats' => 3])->assertStatus(422)->assertJsonValidationErrors('stops.1.time');
        $unpriced = $this->stops();
        unset($unpriced[0]['fare_to_next']);
        $this->postJson('/api/driver/listings', ['stops' => $unpriced, 'seats' => 3])->assertStatus(422)->assertJsonValidationErrors('stops.0.fare_to_next');
        $this->postJson('/api/driver/listings', ['stops' => [['name' => 'Kigali', 'time' => '07:00']], 'seats' => 3])
            ->assertStatus(422)->assertJsonValidationErrors('stops');
        // Plain listings without stops keep working
        $this->postJson('/api/driver/listings', ['from' => 'Kigali', 'to' => 'Musanze', 'pickup_station' => 'Nyabugogo', 'dep' => '08:00', 'price' => 3000, 'seats' => 2])
            ->assertCreated()->assertJsonCount(0, 'stops');
    }
}
