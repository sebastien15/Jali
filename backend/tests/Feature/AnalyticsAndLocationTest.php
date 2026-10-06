<?php

namespace Tests\Feature;

use App\Models\AdminStation;
use App\Models\Booking;
use App\Models\Location;
use App\Models\LocationChangeRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AnalyticsAndLocationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_station_admin_analytics_only_count_their_station(): void
    {
        $admin = $this->actingAsRole('admin');
        // A station with no bookings at all.
        $empty = AdminStation::whereNull('user_id')->get()
            ->first(fn ($s) => !Booking::where('type', 'trip')->whereHas('departure.route', fn ($r) => $r->where('from_station_id', $s->id))->exists()
                && !Location::where('city', $s->city)->whereHas('bookings')->exists());
        $empty->update(['user_id' => $admin->id]);

        $this->getJson('/api/analytics/bookings')->assertOk()->assertJsonPath('data.total_bookings', 0);
        $this->getJson('/api/analytics/revenue')->assertOk()->assertJsonPath('data.delivered_bookings', 0);
    }

    public function test_superadmin_analytics_cover_all_bookings_including_trips(): void
    {
        $this->actingAsRole('superadmin');

        $this->getJson('/api/analytics/bookings')->assertOk()
            ->assertJsonPath('data.total_bookings', Booking::count())
            ->assertJsonPath('data.by_type.trip', Booking::where('type', 'trip')->count());
    }

    public function test_admin_earnings_are_only_from_bookings_they_handled(): void
    {
        $admin = $this->actingAsRole('admin');
        Booking::where('status', 'delivered')->first()->forceFill(['confirmed_by' => $admin->id])->save();
        $mine = Booking::where('confirmed_by', $admin->id)->where('status', 'delivered')->sum('service_fee') * 0.5;

        $this->assertEquals($mine, $this->getJson('/api/analytics/earnings')->assertOk()->json('data.total_earnings'));
    }

    public function test_station_analytics_runs_for_superadmin(): void
    {
        $this->actingAsRole('superadmin');

        $this->getJson('/api/analytics/stations')->assertOk()->assertJsonStructure(['data' => [['id', 'total_bookings', 'admin_name']]]);
    }

    public function test_station_admin_cannot_approve_location_requests(): void
    {
        $admin = $this->actingAsRole('admin');
        $req = LocationChangeRequest::create([
            'admin_id' => $admin->id, 'to_location_id' => Location::first()->id, 'status' => 'pending',
        ]);

        $this->postJson("/api/admin/location-requests/{$req->id}/approve")->assertForbidden();
    }

    public function test_superadmin_approval_moves_the_admin(): void
    {
        $admin = $this->makeUser('admin');
        $target = Location::first();
        $req = LocationChangeRequest::create([
            'admin_id' => $admin->id, 'to_location_id' => $target->id, 'status' => 'pending',
        ]);
        Sanctum::actingAs($this->makeUser('superadmin'));

        $this->postJson("/api/admin/location-requests/{$req->id}/approve")->assertOk();

        $this->assertSame($target->id, (int) $admin->fresh()->location_id);
        $this->assertSame('approved', $req->fresh()->status);
    }
}
