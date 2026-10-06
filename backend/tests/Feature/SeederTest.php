<?php

namespace Tests\Feature;

use App\Models\AgencyRoute;
use App\Models\Booking;
use App\Models\TripDeparture;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_fresh_seed_produces_bookable_trips(): void
    {
        $this->seed();

        $this->assertGreaterThan(0, TripDeparture::count());
        $this->assertSame(0, AgencyRoute::where('price', '<=', 0)->count());
        $this->assertGreaterThan(0, Booking::whereNotNull('trip_departure_id')->count());

        $this->actingAsRole('user');
        $this->getJson('/api/trips')
            ->assertOk()
            ->assertJsonPath('data.0.departures.0.id', fn ($id) => $id > 0);
    }
}
