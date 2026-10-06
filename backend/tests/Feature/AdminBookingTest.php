<?php

namespace Tests\Feature;

use App\Models\AdminStation;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBookingTest extends TestCase
{
    use RefreshDatabase;

    private Booking $booking;      // trip booking departing from $station
    private AdminStation $station;
    private AdminStation $otherStation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Storage::fake('public');

        $this->booking = Booking::where('type', 'trip')->where('status', 'pending')->with('departure.route')->firstOrFail();
        $this->station = AdminStation::findOrFail($this->booking->departure->route->from_station_id);
        $this->otherStation = AdminStation::whereKeyNot($this->station->id)->firstOrFail();
    }

    private function stationAdmin(AdminStation $station): User
    {
        $admin = $this->actingAsRole('admin');
        AdminStation::whereKey($station->id)->update(['user_id' => $admin->id]);
        return $admin;
    }

    public function test_station_admin_sees_only_own_station_bookings(): void
    {
        $this->stationAdmin($this->otherStation);

        $ids = collect($this->getJson('/api/admin/bookings')->assertOk()->json())->pluck('id');

        $this->assertNotContains($this->booking->id, $ids);
    }

    public function test_admin_without_station_is_denied(): void
    {
        $this->actingAsRole('admin');

        $this->getJson('/api/admin/bookings')->assertForbidden()
            ->assertJsonPath('message', 'No station assigned to your account.');
        $this->patchJson("/api/admin/bookings/{$this->booking->id}", ['status' => 'taken'])->assertForbidden();
    }

    public function test_admin_cannot_manage_other_station_booking(): void
    {
        $this->stationAdmin($this->otherStation);

        $this->patchJson("/api/admin/bookings/{$this->booking->id}", ['status' => 'taken'])->assertForbidden();
        $this->assertSame('pending', $this->booking->fresh()->status);
    }

    public function test_rentals_are_superadmin_only(): void
    {
        $rental = Booking::where('type', 'rental')->firstOrFail();
        $this->stationAdmin($this->station);

        $this->patchJson("/api/admin/bookings/{$rental->id}", ['status' => 'cancelled'])->assertForbidden();
    }

    public function test_full_happy_path_records_who_claimed(): void
    {
        $admin = $this->stationAdmin($this->station);
        $id = $this->booking->id;

        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'taken'])->assertOk();
        $this->postJson("/api/admin/bookings/{$id}/ticket", ['ticket' => UploadedFile::fake()->image('t.jpg')])
            ->assertOk()->assertJsonPath('status', 'ticket_ready');
        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'delivered'])->assertOk();

        $b = $this->booking->fresh();
        $this->assertSame('delivered', $b->status);
        $this->assertSame($admin->id, (int) $b->confirmed_by);
        $this->assertNotNull($b->ticket_photo_url);
    }

    public function test_status_cannot_skip_steps_or_go_backwards(): void
    {
        $this->stationAdmin($this->station);
        $id = $this->booking->id;

        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'delivered'])->assertStatus(422);
        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'ticket_ready'])->assertStatus(422);
        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'confirmed'])->assertStatus(422);

        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'taken'])->assertOk();
        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'pending'])->assertStatus(422);
        $this->assertSame('taken', $this->booking->fresh()->status);
    }

    public function test_booking_cannot_be_claimed_twice(): void
    {
        $this->stationAdmin($this->station);
        $id = $this->booking->id;

        $this->patchJson("/api/admin/bookings/{$id}", ['status' => 'taken'])->assertOk();
        $this->postJson("/api/bookings/{$id}/claim")->assertStatus(422);
    }

    public function test_ticket_upload_requires_claim_first(): void
    {
        $this->stationAdmin($this->station);

        $this->postJson("/api/admin/bookings/{$this->booking->id}/ticket", ['ticket' => UploadedFile::fake()->image('t.jpg')])
            ->assertStatus(422);
    }

    public function test_ticket_upload_rejects_non_images(): void
    {
        $this->stationAdmin($this->station);
        $this->patchJson("/api/admin/bookings/{$this->booking->id}", ['status' => 'taken']);

        $this->postJson("/api/admin/bookings/{$this->booking->id}/ticket", [
            'ticket' => UploadedFile::fake()->create('evil.php', 10, 'application/x-php'),
        ])->assertStatus(422);
    }

    public function test_superadmin_can_manage_any_booking(): void
    {
        $rental = Booking::where('type', 'rental')->where('status', 'pending')->firstOrFail();
        $this->actingAsRole('superadmin');

        $this->postJson("/api/bookings/{$rental->id}/claim")->assertOk();
    }

    public function test_regular_user_cannot_use_admin_endpoints(): void
    {
        $this->actingAsRole('user');

        $this->getJson('/api/admin/bookings')->assertForbidden();
        $this->postJson("/api/bookings/{$this->booking->id}/claim")->assertForbidden();
    }

    public function test_station_admin_can_view_booking_of_own_station_but_not_others(): void
    {
        $this->stationAdmin($this->station);
        $this->getJson("/api/bookings/{$this->booking->id}")->assertOk();

        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson("/api/bookings/{$this->booking->id}")->assertForbidden();
    }
}
