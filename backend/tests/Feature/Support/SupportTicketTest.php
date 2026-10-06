<?php

namespace Tests\Feature\Support;

use App\Models\ActivityLog;
use App\Models\Ride;
use App\Models\Role;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** S16.3: tickets linked to a trip, staff inbox with SLA, assignment, canned replies; safety first. */
class SupportTicketTest extends TestCase
{
    use RefreshDatabase;

    private User $rider;
    private User $agent;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->rider = $this->person('Aline', 'user', 'ExponentPushToken[rider]');
        $this->agent = $this->person('Agent Eric', 'admin', 'ExponentPushToken[agent]');
    }

    private function person(string $name, string $role, ?string $token = null): User
    {
        static $n = 0;
        $n++;

        return User::create(['name' => $name, 'phone' => '+25078810000' . $n, 'fcm_token' => $token, 'role_id' => Role::where('name', $role)->value('id')]);
    }

    private function ride(User $rider): Ride
    {
        return Ride::create([
            'rider_id' => $rider->id, 'vehicle_class' => 'car', 'status' => 'completed',
            'pickup_lat' => -1.9441, 'pickup_lng' => 30.0619, 'dropoff_lat' => -1.95, 'dropoff_lng' => 30.125,
            'est_distance_km' => 7.2, 'est_minutes' => 18, 'rate_snapshot' => ['per_km' => 400], 'driver_fare' => 3400,
            'service_fee' => 0, 'quoted_fare' => 3400, 'commission_pct' => 0, 'start_pin' => '1234', 'requested_at' => now(),
        ]);
    }

    private function open(array $data): \Illuminate\Testing\TestResponse
    {
        Sanctum::actingAs($this->rider);

        return $this->postJson('/api/support/tickets', $data);
    }

    public function test_customer_opens_a_ticket_about_their_own_trip_only(): void
    {
        $ride = $this->ride($this->rider);
        $res = $this->open(['category' => 'charged_wrong', 'subject_type' => 'ride', 'subject_id' => $ride->id,
            'message' => 'The driver asked me for 5000 instead of 3400.'])->assertCreated()
            ->assertJsonPath('status', 'open')->assertJsonPath('priority', 'normal')
            ->assertJsonPath('subject.type', 'ride')->assertJsonPath('messages.0.author', 'Aline');
        OpenApiContract::assertResponse($res, 'post', '/support/tickets');
        $this->assertEqualsWithDelta(now()->addDay()->timestamp, SupportTicket::first()->first_response_due_at->timestamp, 5);

        $someoneElses = $this->ride($this->person('Other', 'user'));
        $this->open(['category' => 'lost_item', 'subject_type' => 'ride', 'subject_id' => $someoneElses->id, 'message' => 'I lost my bag'])
            ->assertStatus(422)->assertJsonValidationErrors('subject_id');

        $list = $this->getJson('/api/support/tickets')->assertOk()->assertJsonCount(1, 'data');
        OpenApiContract::assertResponse($list, 'get', '/support/tickets');
        OpenApiContract::assertResponse($this->getJson('/api/support/tickets/' . $res->json('id'))->assertOk(), 'get', '/support/tickets/{id}');

        Sanctum::actingAs($this->person('Nosy', 'user'));
        $this->getJson('/api/support/tickets/' . $res->json('id'))->assertNotFound();
        $this->postJson('/api/support/tickets/' . $res->json('id') . '/messages', ['body' => 'hi'])->assertNotFound();
    }

    public function test_safety_tickets_are_urgent_and_alert_support_staff(): void
    {
        $this->open(['category' => 'safety', 'message' => 'The driver was driving dangerously.'])->assertCreated()
            ->assertJsonPath('priority', 'urgent');
        $this->assertEqualsWithDelta(now()->addHour()->timestamp, SupportTicket::first()->first_response_due_at->timestamp, 5);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[agent]' && $r['title'] === 'Urgent safety ticket');
        Http::assertNotSent(fn ($r) => $r['to'] === 'ExponentPushToken[rider]');
    }

    public function test_staff_inbox_sla_assignment_reply_and_resolve(): void
    {
        $normal = $this->open(['category' => 'account', 'message' => 'How do I change my phone?'])->json('id');
        $this->travelTo(now()->addMinutes(5));
        $urgent = $this->open(['category' => 'safety', 'message' => 'I felt unsafe on my trip.'])->json('id');
        $this->travelTo(now()->addHours(2));

        Sanctum::actingAs($this->agent);
        $inbox = $this->getJson('/api/admin/support/tickets')->assertOk()
            ->assertJsonPath('data.0.id', $urgent)->assertJsonPath('data.1.id', $normal)
            ->assertJsonPath('data.0.sla.overdue', true)->assertJsonPath('data.1.sla.overdue', false)
            ->assertJsonPath('counts', ['open' => 2, 'urgent' => 1, 'overdue' => 1]);
        OpenApiContract::assertResponse($inbox, 'get', '/admin/support/tickets');

        $assigned = $this->postJson("/api/admin/support/tickets/$urgent/assign")->assertOk()->assertJsonPath('assignee.name', 'Agent Eric');
        OpenApiContract::assertResponse($assigned, 'post', '/admin/support/tickets/{id}/assign');
        $this->getJson('/api/admin/support/tickets?mine=1')->assertJsonCount(1, 'data');
        $this->postJson("/api/admin/support/tickets/$urgent/assign", ['admin_id' => $this->rider->id])->assertStatus(422);

        $reply = $this->postJson("/api/admin/support/tickets/$urgent/messages", ['body' => 'We are sorry. We suspended the driver while we check.'])
            ->assertOk()->assertJsonPath('status', 'answered')->assertJsonPath('sla.overdue', false)
            ->assertJsonPath('messages.1.author', 'Agent Eric');
        OpenApiContract::assertResponse($reply, 'post', '/admin/support/tickets/{id}/messages');
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[rider]' && $r['title'] === 'Jali support replied'
            && (((array) $r['data'])['screen'] ?? null) === 'support_ticket');

        // The customer sees "Jali support", replies, and the ticket is open again
        Sanctum::actingAs($this->rider);
        $this->getJson("/api/support/tickets/$urgent")->assertJsonPath('messages.1.author', 'Jali support');
        $this->postJson("/api/support/tickets/$urgent/messages", ['body' => 'Thank you.'])->assertOk()->assertJsonPath('status', 'open');

        Sanctum::actingAs($this->agent);
        $resolved = $this->postJson("/api/admin/support/tickets/$urgent/status", ['status' => 'resolved'])->assertOk()->assertJsonPath('status', 'resolved');
        OpenApiContract::assertResponse($resolved, 'post', '/admin/support/tickets/{id}/status');
        OpenApiContract::assertResponse($this->getJson("/api/admin/support/tickets/$urgent")->assertOk(), 'get', '/admin/support/tickets/{id}');
        $this->assertSame(['support_ticket_assigned', 'support_ticket_status'], ActivityLog::where('entity_type', 'support_ticket')->orderBy('id')->pluck('action')->all());

        Sanctum::actingAs($this->rider);
        $this->postJson("/api/support/tickets/$urgent/messages", ['body' => 'One more thing'])->assertStatus(409);
        $mine = $this->postJson("/api/support/tickets/$normal/resolve")->assertOk()->assertJsonPath('status', 'resolved');
        OpenApiContract::assertResponse($mine, 'post', '/support/tickets/{id}/resolve');
    }

    public function test_canned_replies_and_staff_only_access(): void
    {
        Sanctum::actingAs($this->agent);
        $created = $this->postJson('/api/admin/support/canned-replies', ['title' => 'Refund on the way', 'body' => 'Your refund is on the way.'])
            ->assertCreated();
        OpenApiContract::assertResponse($created, 'post', '/admin/support/canned-replies');
        OpenApiContract::assertResponse($this->getJson('/api/admin/support/canned-replies')->assertOk()->assertJsonCount(1, 'data'), 'get', '/admin/support/canned-replies');
        $this->deleteJson('/api/admin/support/canned-replies/' . $created->json('id'))->assertNoContent();

        foreach (['user', 'driver'] as $role) {
            Sanctum::actingAs($this->person($role, $role));
            $this->getJson('/api/admin/support/tickets')->assertStatus(403);
            $this->getJson('/api/admin/support/canned-replies')->assertStatus(403);
            $this->getJson('/api/support/tickets')->assertOk();
        }
    }
}
