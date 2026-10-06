<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\AdminStation;
use App\Models\Booking;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Negative ownership tests for the admin booking queue and booking analytics
 * (runbook §2: station/location scope must not widen during extraction).
 * Station A owns the seeded trip booking; station B is any other station.
 * Bus/private bookings are scoped by their pickup location's city.
 */
class AdminBookingScopeTest extends TestCase
{
    use RefreshDatabase;

    private Booking $tripA;        // trip departing from station A
    private Booking $busA;         // bus booking picked up in station A's city
    private Booking $privateB;     // private booking picked up in another city
    private AdminStation $stationA;
    private AdminStation $stationB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Storage::fake('public');

        $this->tripA = Booking::where('type', 'trip')->where('status', 'pending')->with('departure.route')->firstOrFail();
        $this->stationA = AdminStation::findOrFail($this->tripA->departure->route->from_station_id);
        $this->stationB = AdminStation::where('city', '!=', $this->stationA->city)->firstOrFail();

        $owner = User::firstOrFail();
        $locationA = Location::where('city', $this->stationA->city)->firstOrFail();
        $locationB = Location::where('city', $this->stationB->city)->firstOrFail();

        $this->busA = Booking::create([
            'user_id' => $owner->id, 'location_id' => $locationA->id, 'type' => 'bus', 'reference_id' => 1,
            'title' => 'Bus A', 'sub' => 'Departs 07:00', 'price' => 3000, 'service_fee' => 400,
            'status' => 'pending', 'payment_method' => 'Card',
        ]);
        $this->privateB = Booking::create([
            'user_id' => $owner->id, 'location_id' => $locationB->id, 'type' => 'private', 'reference_id' => 1,
            'title' => 'Private B', 'sub' => 'Departs 08:00', 'price' => 2000, 'service_fee' => 500,
            'status' => 'delivered', 'payment_method' => 'Card',
        ]);
    }

    private function adminOf(AdminStation $station): User
    {
        $admin = $this->actingAsRole('admin');
        AdminStation::whereKey($station->id)->update(['user_id' => $admin->id]);
        return $admin;
    }

    /** Expected scope, computed independently of Booking::manageableBy. */
    private function expectedIdsFor(AdminStation $station): array
    {
        $trips = Booking::where('type', 'trip')
            ->whereHas('departure.route', fn ($r) => $r->where('from_station_id', $station->id))->pluck('id');
        $local = Booking::whereIn('type', ['bus', 'private'])
            ->whereHas('location', fn ($l) => $l->where('city', $station->city))->pluck('id');

        return $trips->merge($local)->sort()->values()->all();
    }

    public function test_station_b_admin_cannot_list_claim_upload_or_cancel_station_a_bookings(): void
    {
        $this->adminOf($this->stationB);
        $logs = ActivityLog::count();

        $ids = collect($this->getJson('/api/admin/bookings')->assertOk()->json())->pluck('id');
        $this->assertNotContains($this->tripA->id, $ids);
        $this->assertNotContains($this->busA->id, $ids);
        $this->assertContains($this->privateB->id, $ids);

        foreach ([$this->tripA, $this->busA] as $booking) {
            $this->patchJson("/api/admin/bookings/{$booking->id}", ['status' => 'taken'])->assertForbidden()
                ->assertJsonPath('message', 'You can only manage bookings for your assigned station.');
            $this->patchJson("/api/admin/bookings/{$booking->id}", ['status' => 'cancelled'])->assertForbidden();
            $this->patchJson("/api/admin/bookings/{$booking->id}", ['ticket_photo_url' => 'https://x.test/t.jpg'])->assertForbidden();
            // Ownership is checked before the file is validated or stored (no GD needed).
            $this->postJson("/api/admin/bookings/{$booking->id}/ticket", [
                'ticket' => UploadedFile::fake()->create('t.jpg', 10, 'image/jpeg'),
            ])->assertForbidden();

            // Legacy lifecycle endpoints answer 404 for bookings outside the admin's scope.
            $this->postJson("/api/bookings/{$booking->id}/claim")->assertNotFound()->assertExactJson(['error' => 'Booking not found']);
            $this->patchJson("/api/bookings/{$booking->id}/ticket", ['ticket_photo_url' => 'https://x.test/t.jpg'])->assertNotFound();
            $this->postJson("/api/bookings/{$booking->id}/deliver")->assertNotFound();
            $this->getJson("/api/bookings/{$booking->id}")->assertForbidden();

            $fresh = $booking->fresh();
            $this->assertSame('pending', $fresh->status);
            $this->assertNull($fresh->confirmed_by);
            $this->assertNull($fresh->ticket_photo_url);
        }

        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertSame($logs, ActivityLog::count());
    }

    public function test_station_a_admin_queue_is_exactly_their_trips_and_local_bookings(): void
    {
        $this->adminOf($this->stationA);

        $ids = collect($this->getJson('/api/admin/bookings')->assertOk()->json())->pluck('id')->sort()->values()->all();

        $this->assertSame($this->expectedIdsFor($this->stationA), $ids);
        $this->assertContains($this->busA->id, $ids);
        $this->assertNotContains($this->privateB->id, $ids);
        $this->assertNotContains(Booking::where('type', 'rental')->value('id'), $ids);
    }

    public function test_station_a_admin_can_claim_and_cancel_own_bus_booking(): void
    {
        $admin = $this->adminOf($this->stationA);

        $this->patchJson("/api/admin/bookings/{$this->busA->id}", ['status' => 'taken'])->assertOk()
            ->assertJsonPath('status', 'taken');
        $this->patchJson("/api/admin/bookings/{$this->busA->id}", ['status' => 'cancelled'])->assertOk();

        $this->assertSame('cancelled', $this->busA->fresh()->status);
        $this->assertSame($admin->id, (int) $this->busA->fresh()->confirmed_by);
        $this->assertSame(['booking_claimed', 'booking_cancelled'],
            ActivityLog::where('entity_type', 'booking')->where('entity_id', $this->busA->id)->orderBy('id')->pluck('action')->all());
    }

    public function test_ticket_upload_lifecycle_without_gd(): void
    {
        $admin = $this->adminOf($this->stationA);
        $ticket = fn () => UploadedFile::fake()->create('t.jpg', 10, 'image/jpeg');
        $id = $this->busA->id;

        $this->postJson("/api/admin/bookings/{$id}/ticket", ['ticket' => $ticket()])->assertStatus(422)
            ->assertExactJson(['message' => 'Cannot upload a ticket for a pending booking.']);
        $this->patchJson("/api/admin/bookings/{$id}", ['ticket_photo_url' => 'https://x.test/t.jpg'])->assertStatus(422)
            ->assertExactJson(['message' => 'Claim the booking before adding a ticket.']);
        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'taken'])->assertOk();
        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'ticket_ready'])->assertStatus(422)
            ->assertExactJson(['message' => 'Upload a ticket before marking it ready.']);
        $this->assertSame([], Storage::disk('public')->allFiles());

        $url = $this->postJson("/api/admin/bookings/{$id}/ticket", ['ticket' => $ticket()])->assertOk()
            ->assertJsonPath('status', 'ticket_ready')->json('ticket_photo_url');
        $this->assertCount(1, Storage::disk('public')->allFiles('tickets'));
        $this->assertSame($url, $this->busA->fresh()->ticket_photo_url);

        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'delivered'])->assertOk()->assertJsonPath('status', 'delivered');
        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'cancelled'])->assertStatus(422)
            ->assertExactJson(['message' => 'Cannot change a delivered booking to cancelled.']);
        $this->postJson("/api/bookings/{$id}/deliver")->assertStatus(422)
            ->assertExactJson(['error' => 'Invalid status change', 'message' => 'Cannot change a delivered booking to delivered.']);

        $this->assertSame(['booking_claimed', 'ticket_uploaded', 'booking_delivered'],
            ActivityLog::where('admin_id', $admin->id)->where('entity_id', $id)->orderBy('id')->pluck('action')->all());
    }

    public function test_legacy_lifecycle_endpoints_log_the_same_actions(): void
    {
        $admin = $this->adminOf($this->stationA);
        $id = $this->busA->id;

        $this->postJson("/api/bookings/{$id}/claim")->assertOk()->assertExactJson(['status' => 'taken', 'message' => 'Booking updated.']);
        $this->patchJson("/api/bookings/{$id}/ticket", ['ticket_photo_url' => 'nope'])->assertStatus(422);
        $this->patchJson("/api/bookings/{$id}/ticket", ['ticket_photo_url' => 'https://x.test/t.jpg'])->assertOk();
        $this->postJson("/api/bookings/{$id}/deliver")->assertOk();

        $this->assertSame('https://x.test/t.jpg', $this->busA->fresh()->ticket_photo_url);
        $logs = ActivityLog::where('admin_id', $admin->id)->where('entity_id', $id)->orderBy('id')->get();
        $this->assertSame(['booking_claimed', 'ticket_uploaded', 'booking_delivered'], $logs->pluck('action')->all());
        $this->assertSame(['title' => 'Bus A', 'from' => 'pending', 'to' => 'taken'], $logs[0]->details);
    }

    public function test_superadmin_sees_and_manages_every_station(): void
    {
        $this->actingAsRole('superadmin');

        $ids = collect($this->getJson('/api/admin/bookings')->assertOk()->json())->pluck('id');
        $this->assertCount(Booking::count(), $ids);

        $this->patchJson("/api/admin/bookings/{$this->busA->id}", ['status' => 'cancelled'])->assertOk();
        $this->postJson("/api/bookings/{$this->tripA->id}/claim")->assertOk()
            ->assertExactJson(['status' => 'taken', 'message' => 'Booking updated.']);
    }

    public function test_status_filter_does_not_widen_scope(): void
    {
        $this->adminOf($this->stationB);

        $ids = collect($this->getJson('/api/admin/bookings?status=pending')->assertOk()->json())->pluck('id');

        $this->assertNotContains($this->tripA->id, $ids);
        $this->assertNotContains($this->busA->id, $ids);
    }

    public function test_station_analytics_only_count_the_admins_station(): void
    {
        $this->adminOf($this->stationA);
        $expected = Booking::whereIn('id', $this->expectedIdsFor($this->stationA))->get();
        $delivered = $expected->where('status', 'delivered');

        $this->getJson('/api/analytics/bookings')->assertOk()
            ->assertJsonPath('data.total_bookings', $expected->count())
            ->assertJsonPath('data.total_revenue', (int) $expected->sum(fn ($b) => $b->price + $b->service_fee))
            ->assertJsonPath('data.by_type.bus', $expected->where('type', 'bus')->count())
            ->assertJsonPath('data.by_type.rental', 0);
        $this->getJson('/api/analytics/revenue')->assertOk()
            ->assertJsonPath('data.delivered_bookings', $delivered->count())
            ->assertJsonPath('data.total_service_provider', (int) $delivered->sum('price'));

        $locations = collect($this->getJson('/api/analytics/stations')->assertOk()->json('data'));
        $this->assertSame(
            $expected->pluck('location_id')->filter()->unique()->sort()->values()->all(),
            $locations->pluck('id')->sort()->values()->all(),
        );
        $this->assertNotContains($this->privateB->location_id, $locations->pluck('id'));
    }

    public function test_station_b_admin_analytics_exclude_station_a(): void
    {
        $this->adminOf($this->stationB);

        $this->getJson('/api/analytics/bookings')->assertOk()
            ->assertJsonPath('data.total_bookings', count($this->expectedIdsFor($this->stationB)));
        $this->assertNotContains($this->busA->location_id,
            collect($this->getJson('/api/analytics/stations')->assertOk()->json('data'))->pluck('id'));
    }

    public function test_superadmin_analytics_cover_every_location_and_booking(): void
    {
        $this->actingAsRole('superadmin');

        $this->getJson('/api/analytics/bookings')->assertOk()->assertJsonPath('data.total_bookings', Booking::count());
        $this->getJson('/api/analytics/revenue')->assertOk()
            ->assertJsonPath('data.delivered_bookings', Booking::where('status', 'delivered')->count());
        $this->assertCount(Location::count(), $this->getJson('/api/analytics/stations')->assertOk()->json('data'));
        $this->getJson('/api/analytics/earnings')->assertOk()
            ->assertJsonPath('data.delivered_count', Booking::where('status', 'delivered')->count());
    }

    public function test_admin_without_station_sees_nothing_in_analytics(): void
    {
        $this->actingAsRole('admin');

        $this->getJson('/api/analytics/bookings')->assertOk()->assertJsonPath('data.total_bookings', 0);
        $this->getJson('/api/analytics/stations')->assertOk()->assertExactJson(['data' => []]);
        $this->getJson('/api/admin/bookings')->assertForbidden();
        $this->postJson("/api/admin/bookings/{$this->busA->id}/ticket", [
            'ticket' => UploadedFile::fake()->create('t.jpg', 10, 'image/jpeg'),
        ])->assertForbidden()->assertJsonPath('message', 'No station assigned to your account.');
    }
}
