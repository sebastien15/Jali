<?php

namespace Tests\Feature;

use App\Models\TripDeparture;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AgencyRatingTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_passengers_who_booked_can_rate(): void
    {
        $this->seed();
        $departure = TripDeparture::with('route')->first();
        $agencyId = $departure->route->agency_id;
        $this->actingAsRole('user');

        $this->postJson("/api/agencies/{$agencyId}/rate", ['stars' => 1])->assertForbidden();

        $this->postJson('/api/bookings', [
            'type' => 'trip', 'reference_id' => $departure->id, 'payment_method' => 'Card', 'travel_date' => 'Tomorrow',
        ])->assertCreated();

        $this->postJson("/api/agencies/{$agencyId}/rate", ['stars' => 5])->assertOk()->assertJsonPath('your_rating', 5);
        // one rating per user — re-rating updates it
        $this->postJson("/api/agencies/{$agencyId}/rate", ['stars' => 4])->assertOk()->assertJsonPath('ratings_count', 1);
    }
}
