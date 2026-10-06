<?php

namespace Tests\Feature\Bus;

use App\Models\ActivityLog;
use App\Models\AdminStation;
use App\Models\Agency;
use App\Models\AgencyRating;
use App\Models\AgencyRoute;
use App\Models\Booking;
use App\Models\Bus;
use App\Models\Corridor;
use App\Models\CorridorTerminal;
use App\Models\Location;
use App\Models\TripDeparture;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Characterization of the bus/departure catalogue, agency ratings and the
 * admin agency/route/departure/location operations before M03-Bus moves them
 * into App\Modules\Bus. Fixtures are built here (no demo seed) so the exact
 * response shapes can be asserted.
 */
class BusParityTest extends TestCase
{
    use RefreshDatabase;

    private AdminStation $kigali;
    private AdminStation $huye;
    private AdminStation $musanze;
    private Agency $agency;
    private AgencyRoute $route;

    protected function setUp(): void
    {
        parent::setUp();

        $this->kigali = AdminStation::create(['name' => 'Nyabugogo', 'city' => 'Kigali', 'province' => 'Kigali', 'district' => 'Nyarugenge', 'type' => 'bus_station']);
        $this->huye = AdminStation::create(['name' => 'Huye Park', 'city' => 'Huye', 'province' => 'Southern', 'district' => 'Huye', 'type' => 'bus_station']);
        $this->musanze = AdminStation::create(['name' => 'Musanze Park', 'city' => 'Musanze', 'province' => 'Northern', 'district' => 'Musanze', 'type' => 'bus_station']);
        $this->agency = Agency::create(['name' => 'Alpha Express']);
        $this->route = AgencyRoute::create([
            'agency_id' => $this->agency->id, 'from_station_id' => $this->kigali->id, 'to_station_id' => $this->huye->id,
            'price' => 3000, 'total_seats' => 30, 'duration_mins' => 150, 'active' => true,
        ]);
        TripDeparture::create(['agency_route_id' => $this->route->id, 'departure_time' => '23:00', 'active' => true]);
        TripDeparture::create(['agency_route_id' => $this->route->id, 'departure_time' => '07:30', 'active' => true]);
        TripDeparture::create(['agency_route_id' => $this->route->id, 'departure_time' => '12:00', 'active' => false]);
    }

    private function adminOf(AdminStation $station): User
    {
        $admin = $this->actingAsRole('admin');
        $station->update(['user_id' => $admin->id]);
        return $admin;
    }

    // ── Public catalogue ──────────────────────────────────────────────

    public function test_buses_list_is_active_only_filtered_and_ordered_by_departure(): void
    {
        Bus::create(['agency' => 'B', 'from' => 'Kigali', 'to' => 'Huye', 'dep' => '09:00', 'arr' => '11:00', 'price' => 2500, 'seats' => 40, 'active' => true]);
        Bus::create(['agency' => 'A', 'from' => 'Kigali', 'to' => 'Huye', 'dep' => '06:00', 'arr' => '08:00', 'price' => 2500, 'seats' => 40, 'active' => true]);
        Bus::create(['agency' => 'C', 'from' => 'Kigali', 'to' => 'Huye', 'dep' => '05:00', 'arr' => '07:00', 'price' => 2500, 'seats' => 40, 'active' => false]);
        Bus::create(['agency' => 'D', 'from' => 'Kigali', 'to' => 'Musanze', 'dep' => '04:00', 'arr' => '06:00', 'price' => 2500, 'seats' => 40, 'active' => true]);
        $this->actingAsRole('user');

        $this->getJson('/api/buses?from=Kigali&to=Huye')->assertOk()
            ->assertJsonCount(2)->assertJsonPath('0.agency', 'A')->assertJsonPath('1.agency', 'B')
            ->assertJsonPath('0.active', true);
        $this->assertSame(['D', 'A', 'B'], collect($this->getJson('/api/buses')->json())->pluck('agency')->all());
        $this->assertEqualsCanonicalizing(
            ['id', 'agency', 'from', 'to', 'dep', 'arr', 'price', 'seats', 'rating', 'active', 'created_at', 'updated_at'],
            array_keys($this->getJson('/api/buses')->json(0)),
        );
    }

    public function test_trip_search_shape_arrival_wrap_and_active_departures_only(): void
    {
        $user = $this->actingAsRole('user');
        AgencyRating::create(['agency_id' => $this->agency->id, 'user_id' => $user->id, 'stars' => 4]);
        // Active route whose only departure is inactive → not listed.
        $hidden = AgencyRoute::create([
            'agency_id' => $this->agency->id, 'from_station_id' => $this->kigali->id, 'to_station_id' => $this->musanze->id,
            'price' => 2000, 'total_seats' => 20, 'duration_mins' => 90, 'active' => true,
        ]);
        TripDeparture::create(['agency_route_id' => $hidden->id, 'departure_time' => '08:00', 'active' => false]);

        $res = $this->getJson("/api/trips?agency_id={$this->agency->id}")->assertOk();

        $res->assertJsonPath('per_page', 20)->assertJsonPath('total', 1)->assertJsonPath('current_page', 1);
        $this->assertSame([
            'id'                   => $this->route->id,
            'agency_id'            => $this->agency->id,
            'agency_name'          => 'Alpha Express',
            'agency_rating'        => 4,
            'agency_ratings_count' => 1,
            'from'                 => ['id' => $this->kigali->id, 'name' => 'Nyabugogo', 'city' => 'Kigali'],
            'to'                   => ['id' => $this->huye->id, 'name' => 'Huye Park', 'city' => 'Huye'],
            'price'                => 3000,
            'total_seats'          => 30,
            'duration_mins'        => 150,
            'departures'           => [
                ['id' => TripDeparture::where('departure_time', 'like', '07:30%')->value('id'), 'departure_time' => '07:30', 'estimated_arrival_time' => '10:00'],
                ['id' => TripDeparture::where('departure_time', 'like', '23:00%')->value('id'), 'departure_time' => '23:00', 'estimated_arrival_time' => '01:30'],
            ],
        ], $res->json('data.0'));
    }

    public function test_trip_search_filters_and_validation(): void
    {
        $this->actingAsRole('user');

        $this->getJson("/api/trips?from_station_id={$this->kigali->id}&to_station_id={$this->huye->id}")->assertOk()->assertJsonPath('total', 1);
        $this->getJson("/api/trips?to_station_id={$this->musanze->id}")->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/trips?from_station_id=999999')->assertStatus(422)->assertJsonValidationErrors('from_station_id');

        $this->route->update(['active' => false]);
        $this->getJson('/api/trips')->assertOk()->assertJsonPath('total', 0);
    }

    // ── Agency ratings ────────────────────────────────────────────────

    public function test_rating_requires_a_live_trip_booking_with_that_agency(): void
    {
        $user = $this->actingAsRole('user');
        $departure = $this->route->departures()->first();

        $this->postJson('/api/agencies/999999/rate', ['stars' => 5])->assertNotFound();
        $this->postJson("/api/agencies/{$this->agency->id}/rate", ['stars' => 5])->assertForbidden()
            ->assertExactJson(['message' => 'You can rate an agency after booking a trip with it.']);

        $booking = Booking::create([
            'user_id' => $user->id, 'type' => 'trip', 'reference_id' => $departure->id, 'trip_departure_id' => $departure->id,
            'title' => 't', 'sub' => 's', 'price' => 3000, 'service_fee' => 500, 'status' => 'cancelled', 'payment_method' => 'Card',
        ]);
        $this->postJson("/api/agencies/{$this->agency->id}/rate", ['stars' => 5])->assertForbidden();

        $booking->update(['status' => 'pending']);
        $this->postJson("/api/agencies/{$this->agency->id}/rate", ['stars' => 6])->assertStatus(422);
        $this->postJson("/api/agencies/{$this->agency->id}/rate", ['stars' => 5, 'comment' => 'Good'])->assertOk()
            ->assertExactJson(['average_rating' => 5, 'ratings_count' => 1, 'your_rating' => 5]);

        Sanctum::actingAs($other = $this->makeUser('user'));
        Booking::create([
            'user_id' => $other->id, 'type' => 'trip', 'reference_id' => $departure->id, 'trip_departure_id' => $departure->id,
            'title' => 't', 'sub' => 's', 'price' => 3000, 'service_fee' => 500, 'status' => 'delivered', 'payment_method' => 'Card',
        ]);
        $this->postJson("/api/agencies/{$this->agency->id}/rate", ['stars' => 2])->assertOk()
            ->assertExactJson(['average_rating' => 3.5, 'ratings_count' => 2, 'your_rating' => 2]);
        $this->assertNull(AgencyRating::where('user_id', $other->id)->value('comment'));
    }

    // ── Admin: agencies, routes, departures ─────────────────────────────

    public function test_station_admin_cannot_create_or_change_routes_departing_elsewhere(): void
    {
        $this->adminOf($this->huye);
        $departure = $this->route->departures()->first();
        $deny = 'You can only manage routes departing from your assigned station.';

        $this->postJson('/api/admin/trips', [
            'agency_id' => $this->agency->id, 'from_station_id' => $this->kigali->id, 'to_station_id' => $this->musanze->id,
            'price' => 2000, 'total_seats' => 20, 'duration_mins' => 60,
        ])->assertForbidden()->assertJsonPath('message', $deny);
        $this->postJson("/api/admin/agencies/{$this->agency->id}/routes", [
            'from_station_id' => $this->kigali->id, 'to_station_id' => $this->musanze->id,
        ])->assertForbidden()->assertJsonPath('message', $deny);
        $this->deleteJson("/api/admin/agencies/{$this->agency->id}/routes/{$this->route->id}")->assertForbidden();
        $this->deleteJson("/api/admin/trips/{$this->route->id}/departures/{$departure->id}")->assertForbidden();

        $this->assertSame(1, AgencyRoute::where('from_station_id', $this->kigali->id)->count());
        $this->assertNotNull($departure->fresh());
        $this->assertSame(0, ActivityLog::count());
    }

    public function test_station_admin_manages_own_station_routes_and_departures(): void
    {
        $admin = $this->adminOf($this->kigali);

        $created = $this->postJson('/api/admin/trips', [
            'agency_id' => $this->agency->id, 'from_station_id' => $this->kigali->id, 'to_station_id' => $this->musanze->id,
            'price' => 2000, 'total_seats' => 20, 'duration_mins' => 60, 'departure_time' => '06:15',
        ])->assertCreated();
        $this->assertSame([
            'id' => $created->json('id'), 'agency_id' => $this->agency->id, 'agency_name' => 'Alpha Express',
            'from' => ['id' => $this->kigali->id, 'city' => 'Kigali', 'district' => 'Nyarugenge'],
            'to' => ['id' => $this->musanze->id, 'city' => 'Musanze', 'district' => 'Musanze'],
            'price' => 2000, 'total_seats' => 20, 'duration_mins' => 60, 'active' => true,
            'departures' => [['id' => $created->json('departures.0.id'), 'departure_time' => '06:15', 'active' => true]],
        ], $created->json());

        $this->postJson('/api/admin/trips', [
            'agency_id' => $this->agency->id, 'from_station_id' => $this->kigali->id, 'to_station_id' => $this->musanze->id,
            'price' => 2000, 'total_seats' => 20, 'duration_mins' => 60,
        ])->assertStatus(422)->assertExactJson(['error' => 'A route for this agency and stations already exists.']);

        $dep = $this->postJson("/api/admin/trips/{$this->route->id}/departures", ['departure_time' => '18:45'])->assertCreated();
        $this->assertSame(['id' => $dep->json('id'), 'departure_time' => '18:45', 'active' => true], $dep->json());
        $this->postJson("/api/admin/trips/{$this->route->id}/departures", ['departure_time' => '18:45'])->assertStatus(422)
            ->assertExactJson(['error' => 'Departure time already exists for this route.']);
        $this->deleteJson("/api/admin/trips/{$this->route->id}/departures/{$dep->json('id')}")->assertOk()
            ->assertExactJson(['message' => 'Departure removed.']);

        // A station admin may only send operating_hours; name is ignored. (Known gap, not
        // enshrined: operating_hours is not in Agency::$fillable, so it is not saved today.)
        $this->patchJson("/api/admin/agencies/{$this->agency->id}", ['name' => 'Renamed', 'operating_hours' => '05:00-22:00'])->assertOk()
            ->assertJsonPath('name', 'Alpha Express');
        $this->patchJson("/api/admin/agencies/{$this->agency->id}", ['name' => 'Renamed'])->assertStatus(422);

        $this->assertSame(
            ['route_created', 'departure_added', 'departure_removed', 'agency_updated'],
            ActivityLog::where('admin_id', $admin->id)->orderBy('id')->pluck('action')->all(),
        );
    }

    public function test_active_bookings_block_departure_route_and_agency_removal(): void
    {
        $this->actingAsRole('superadmin');
        $departure = $this->route->departures()->first();
        $booking = Booking::create([
            'user_id' => User::first()->id, 'type' => 'trip', 'reference_id' => $departure->id, 'trip_departure_id' => $departure->id,
            'title' => 't', 'sub' => 's', 'price' => 3000, 'service_fee' => 500, 'status' => 'ticket_ready', 'payment_method' => 'Card',
        ]);

        $this->deleteJson("/api/admin/trips/{$this->route->id}/departures/{$departure->id}")->assertStatus(409)
            ->assertExactJson(['error' => 'Cannot remove departure with active bookings.']);
        $this->deleteJson("/api/admin/agencies/{$this->agency->id}/routes/{$this->route->id}")->assertStatus(409)
            ->assertExactJson(['error' => 'Cannot delete route with active bookings.', 'message' => 'Cannot delete route with active bookings.']);
        $this->deleteJson("/api/admin/agencies/{$this->agency->id}")->assertStatus(409)
            ->assertExactJson(['error' => 'Cannot delete an agency with active bookings.', 'message' => 'Cannot delete an agency with active bookings.']);

        $booking->update(['status' => 'delivered']);
        $this->deleteJson("/api/admin/agencies/{$this->agency->id}/routes/{$this->route->id}")->assertOk()
            ->assertExactJson(['message' => 'Route removed']);
        $this->deleteJson("/api/admin/agencies/{$this->agency->id}")->assertOk()->assertExactJson(['message' => 'Agency deleted']);
    }

    public function test_superadmin_creates_agency_and_lists_agencies_with_routes(): void
    {
        $this->actingAsRole('superadmin');

        $id = $this->postJson('/api/admin/agencies', ['name' => 'Beta Coach'])->assertCreated()
            ->assertJsonPath('name', 'Beta Coach')->assertJsonPath('routes', [])->json('id');
        $this->postJson("/api/admin/agencies/{$id}/routes", ['from_station_id' => $this->huye->id, 'to_station_id' => $this->kigali->id])
            ->assertCreated()->assertJsonPath('from.city', 'Huye')->assertJsonPath('to.district', 'Nyarugenge');
        $this->postJson("/api/admin/agencies/{$id}/routes", ['from_station_id' => $this->huye->id, 'to_station_id' => $this->kigali->id])
            ->assertStatus(409)->assertExactJson(['error' => 'Route already exists']);

        $list = collect($this->getJson('/api/admin/agencies')->assertOk()->json())->keyBy('name');
        $this->assertSame(['id', 'name', 'operating_hours', 'average_rating', 'ratings_count', 'routes'], array_keys($list['Beta Coach']));
        $this->assertSame(['id', 'from', 'to'], array_keys($list['Beta Coach']['routes'][0]));
        $this->assertCount(1, $this->getJson("/api/admin/trips?agency_id={$this->agency->id}&active=1")->assertOk()->json());
    }

    // ── Admin: pickup locations ───────────────────────────────────────

    public function test_locations_are_enriched_with_corridors_and_guarded_on_delete(): void
    {
        $this->actingAsRole('superadmin');
        $corridor = Corridor::create(['code' => 'CRD-01', 'name' => 'Southern', 'description' => 'Kigali-Huye']);
        CorridorTerminal::create(['corridor_id' => $corridor->id, 'terminal_id' => $this->kigali->id, 'stop_order' => 1]);
        $this->route->update(['corridor_id' => $corridor->id]);

        $id = $this->postJson('/api/admin/locations', ['name' => 'Nyabugogo', 'type' => 'bus_station', 'city' => 'Kigali'])
            ->assertCreated()->json('id');
        $other = $this->postJson('/api/admin/locations', ['name' => 'Elsewhere', 'type' => 'custom', 'city' => 'Rubavu'])
            ->assertCreated()->json('id');

        $rows = collect($this->getJson('/api/admin/locations')->assertOk()->json())->keyBy('id');
        $this->assertSame('Kigali', $rows[$id]['province']);
        $this->assertSame([[
            'code' => 'CRD-01', 'name' => 'Southern', 'description' => 'Kigali-Huye', 'stop_order' => 1, 'agencies' => ['Alpha Express'],
        ]], $rows[$id]['corridors']);
        $this->assertNull($rows[$other]['province']);
        $this->assertSame([], $rows[$other]['corridors']);
        $this->assertSame([$other], collect($this->getJson('/api/admin/locations?city=Rubavu')->json())->pluck('id')->all());

        $this->patchJson("/api/admin/locations/{$other}", ['address' => 'Gisenyi'])->assertOk()->assertJsonPath('address', 'Gisenyi');

        Booking::create([
            'user_id' => User::first()->id, 'location_id' => $id, 'type' => 'bus', 'reference_id' => 1,
            'title' => 't', 'sub' => 's', 'price' => 1, 'service_fee' => 1, 'status' => 'delivered', 'payment_method' => 'Card',
        ]);
        $this->deleteJson("/api/admin/locations/{$id}")->assertStatus(422)
            ->assertExactJson(['error' => 'Cannot delete: bookings reference this location.']);
        $this->makeUser('admin', ['location_id' => $other]);
        $this->deleteJson("/api/admin/locations/{$other}")->assertStatus(422)
            ->assertExactJson(['error' => 'Cannot delete: admins are assigned to this location.']);
        $this->assertNotNull(Location::find($other));
    }
}
