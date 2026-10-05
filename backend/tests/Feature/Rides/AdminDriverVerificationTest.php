<?php

namespace Tests\Feature\Rides;

use App\Models\ActivityLog;
use App\Models\DriverDocument;
use App\Models\DriverProfile;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

class AdminDriverVerificationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->admin = $this->user('admin');
    }

    private function user(string $role, ?string $token = null): User
    {
        return User::create(['name' => ucfirst($role), 'phone' => '+2507' . random_int(10000000, 99999999),
            'fcm_token' => $token, 'role_id' => Role::where('name', $role)->value('id')]);
    }

    /** A rider whose application was submitted `$daysAgo` days ago */
    private function applicant(int $daysAgo = 1): User
    {
        $user = $this->user('user', 'ExponentPushToken[applicant]');
        $profile = $user->driverProfile()->create(['services' => ['ride'], 'licence_no' => 'RW-1',
            'licence_categories' => ['B'], 'licence_expiry' => now()->addYear()]);
        $profile->forceFill(['submitted_at' => now()->subDays($daysAgo)])->save();
        foreach (['licence_front', 'national_id'] as $type) {
            $user->driverDocuments()->create(['type' => $type, 'path' => "driver-documents/{$user->id}/$type.jpg"]);
        }
        $user->vehicles()->create(['model' => 'RAV4', 'plate' => 'RAB ' . $user->id . 'A']);

        return $user;
    }

    /** @test */
    public function queue_lists_pending_applications_oldest_first()
    {
        $newer = $this->applicant(1);
        $older = $this->applicant(5);
        $this->user('user')->driverProfile()->create([]);   // draft, never submitted: not in queue
        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/admin/drivers')->assertOk()->assertJsonCount(2)
            ->assertJsonPath('0.user_id', $older->id)->assertJsonPath('1.user_id', $newer->id);
        OpenApiContract::assertResponse($response, 'get', '/admin/drivers');

        $detail = $this->getJson("/api/admin/drivers/{$older->id}")->assertOk()
            ->assertJsonPath('user.id', $older->id)->assertJsonCount(1, 'vehicles');
        OpenApiContract::assertResponse($detail, 'get', '/admin/drivers/{userId}');
    }

    /** @test */
    public function approving_makes_the_rider_a_driver_and_notifies_them()
    {
        $applicant = $this->applicant();
        Sanctum::actingAs($this->admin);

        $response = $this->postJson("/api/admin/drivers/{$applicant->id}/verify")->assertOk()
            ->assertJsonPath('status', 'verified')->assertJsonPath('user.role', 'driver');
        OpenApiContract::assertResponse($response, 'post', '/admin/drivers/{userId}/verify');

        $profile = $applicant->driverProfile->fresh();
        $this->assertSame($this->admin->id, $profile->verified_by);
        $this->assertNotNull($profile->verified_at);
        $this->assertSame(0, DriverDocument::where('status', '!=', 'approved')->count());
        $this->assertNotNull($applicant->vehicles()->first()->verified_at);
        $this->assertTrue($applicant->fresh()->hasPermission('offer-rides'));
        $this->assertDatabaseHas('activity_logs', ['action' => 'driver_verified', 'entity_id' => $applicant->id, 'admin_id' => $this->admin->id]);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[applicant]' && str_contains($r['title'], 'Jali driver'));

        // Can't approve twice
        $this->postJson("/api/admin/drivers/{$applicant->id}/verify")->assertStatus(409);
    }

    /** @test */
    public function rejecting_requires_a_reason_and_can_flag_documents()
    {
        $applicant = $this->applicant();
        Sanctum::actingAs($this->admin);

        OpenApiContract::assertResponse(
            $this->postJson("/api/admin/drivers/{$applicant->id}/reject", [])->assertStatus(422),
            'post', '/admin/drivers/{userId}/reject');

        $response = $this->postJson("/api/admin/drivers/{$applicant->id}/reject", [
            'reason' => 'Please upload a clearer national ID', 'documents' => ['national_id' => 'Blurry'],
        ])->assertOk()->assertJsonPath('status', 'rejected')->assertJsonPath('rejection_reason', 'Please upload a clearer national ID');
        OpenApiContract::assertResponse($response, 'post', '/admin/drivers/{userId}/reject');

        $doc = $applicant->driverDocuments()->where('type', 'national_id')->first();
        $this->assertSame('rejected', $doc->status);
        $this->assertSame('Blurry', $doc->rejection_reason);
        $this->assertSame('uploaded', $applicant->driverDocuments()->where('type', 'licence_front')->value('status'));
        $this->assertSame('user', $applicant->fresh()->role->name);
        Http::assertSent(fn ($r) => $r['body'] === 'Please upload a clearer national ID');
    }

    /** @test */
    public function suspending_a_driver_is_logged_and_notified()
    {
        $applicant = $this->applicant();
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/drivers/{$applicant->id}/verify")->assertOk();

        $response = $this->postJson("/api/admin/drivers/{$applicant->id}/suspend", ['reason' => 'Safety complaint'])
            ->assertOk()->assertJsonPath('status', 'suspended');
        OpenApiContract::assertResponse($response, 'post', '/admin/drivers/{userId}/suspend');

        $this->assertSame(DriverProfile::STATUS_SUSPENDED, $applicant->driverProfile->fresh()->verification_status);
        $this->assertSame(1, ActivityLog::where('action', 'driver_suspended')->count());
    }

    /** @test */
    public function only_driver_reviewers_can_use_the_queue()
    {
        $applicant = $this->applicant();
        $this->getJson('/api/admin/drivers')->assertStatus(401);

        foreach (['user', 'driver'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/admin/drivers')->assertStatus(403);
            $this->postJson("/api/admin/drivers/{$applicant->id}/verify")->assertStatus(403);
        }
        $this->assertSame('pending', $applicant->driverProfile->fresh()->verification_status);

        // Unknown or never-submitted users are 404
        Sanctum::actingAs($this->admin);
        $draft = $this->user('user');
        $draft->driverProfile()->create([]);
        $this->getJson("/api/admin/drivers/{$draft->id}")->assertNotFound();
        $this->getJson('/api/admin/drivers/999999')->assertNotFound();
    }
}
