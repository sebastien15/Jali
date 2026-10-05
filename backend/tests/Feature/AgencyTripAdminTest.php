<?php

namespace Tests\Feature;

use App\Models\AdminStation;
use App\Models\Agency;
use App\Models\AgencyRoute;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AgencyTripAdminTest extends TestCase
{
    use RefreshDatabase;

    private AgencyRoute $route;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->route = AgencyRoute::with('departures')->firstOrFail();
    }

    private function adminOf(int $stationId): User
    {
        $admin = $this->actingAsRole('admin');
        AdminStation::whereKey($stationId)->update(['user_id' => $admin->id]);
        return $admin;
    }

    private function otherStationId(): int
    {
        return AdminStation::whereKeyNot($this->route->from_station_id)->value('id');
    }

    public function test_station_admin_cannot_create_or_delete_agencies(): void
    {
        $this->adminOf($this->route->from_station_id);

        $this->postJson('/api/admin/agencies', ['name' => 'X'])->assertForbidden();
        $this->deleteJson("/api/admin/agencies/{$this->route->agency_id}")->assertForbidden();
        $this->assertNotNull(Agency::find($this->route->agency_id));
    }

    public function test_station_admin_can_only_edit_routes_from_their_station(): void
    {
        $this->adminOf($this->otherStationId());

        $this->patchJson("/api/admin/trips/{$this->route->id}", ['price' => 1])->assertForbidden();
        $this->deleteJson("/api/admin/trips/{$this->route->id}")->assertForbidden();
        $this->postJson("/api/admin/trips/{$this->route->id}/departures", ['departure_time' => '23:55'])->assertForbidden();
    }

    public function test_station_admin_can_edit_own_station_route(): void
    {
        $this->adminOf($this->route->from_station_id);

        $this->patchJson("/api/admin/trips/{$this->route->id}", ['price' => 4500])->assertOk();
        $this->assertSame(4500, (int) $this->route->fresh()->price);
    }

    public function test_route_with_active_bookings_cannot_be_deleted(): void
    {
        $this->actingAsRole('superadmin');
        $booking = Booking::where('type', 'trip')->where('status', 'pending')->with('departure')->firstOrFail();
        $routeId = $booking->departure->agency_route_id;

        $this->deleteJson("/api/admin/trips/{$routeId}")->assertStatus(409);
        $this->deleteJson("/api/admin/agencies/" . AgencyRoute::find($routeId)->agency_id)->assertStatus(409);
    }

    public function test_route_added_without_price_is_inactive_and_cannot_be_activated_unpriced(): void
    {
        $this->actingAsRole('superadmin');
        $agency = Agency::firstOrFail();
        [$from, $to] = AdminStation::orderByDesc('id')->limit(2)->pluck('id');

        $id = $this->postJson("/api/admin/agencies/{$agency->id}/routes", ['from_station_id' => $from, 'to_station_id' => $to])
            ->assertCreated()->json('id');

        $this->assertFalse((bool) AgencyRoute::find($id)->active);
        $this->patchJson("/api/admin/trips/{$id}", ['active' => true])->assertStatus(422);
        $this->patchJson("/api/admin/trips/{$id}", ['active' => true, 'price' => 3000])->assertOk();
    }

    public function test_agency_and_route_detail_endpoints_work(): void
    {
        $this->actingAsRole('superadmin');

        $this->getJson("/api/admin/agencies/{$this->route->agency_id}")->assertOk()->assertJsonPath('id', $this->route->agency_id);
        $this->getJson("/api/admin/trips/{$this->route->id}")->assertOk()->assertJsonPath('id', $this->route->id);
    }
}
