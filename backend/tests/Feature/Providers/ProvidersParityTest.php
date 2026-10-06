<?php

namespace Tests\Feature\Providers;

use App\Models\DriverDocument;
use App\Models\DriverProfile;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * M03-Remaining characterization (Providers/Fleet), runnable without GD:
 * private document access, onboarding refusals, verification guards and
 * role promotion, vehicle activation/removal and the setup screen's vehicle.
 * Written against the pre-module controllers.
 */
class ProvidersParityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function user(string $role): User
    {
        return User::create(['name' => ucfirst($role) . ' Person', 'phone' => '+2507' . random_int(10000000, 99999999),
            'role_id' => Role::where('name', $role)->value('id')]);
    }

    private function pdf(string $type)
    {
        return $this->post('/api/driver/documents',
            ['type' => $type, 'file' => UploadedFile::fake()->create("$type.pdf", 20, 'application/pdf')], ['Accept' => 'application/json']);
    }

    private function applicant(string $role = 'user'): User
    {
        $user = $this->user($role);
        $profile = $user->driverProfile()->create(['services' => ['hire'], 'licence_no' => 'RW-1',
            'licence_categories' => ['B'], 'licence_expiry' => now()->addYear()]);
        $profile->forceFill(['submitted_at' => now()->subDay()])->save();
        $user->driverDocuments()->create(['type' => 'national_id', 'path' => "driver-documents/{$user->id}/id.pdf"]);

        return $user;
    }

    // ── Documents ────────────────────────────────────────────────────────

    public function test_documents_are_streamed_only_to_the_owner_and_driver_reviewers(): void
    {
        $owner = $this->user('user');
        Sanctum::actingAs($owner);
        $this->pdf('national_id')->assertOk()->assertJsonPath('documents.2.status', 'uploaded');
        $doc = DriverDocument::first();
        $this->assertStringStartsWith("driver-documents/{$owner->id}/", $doc->path);

        $own = $this->get("/api/driver/documents/{$doc->id}/file")->assertOk();
        $this->assertStringContainsString('private', $own->headers->get('Cache-Control'));
        $this->assertStringContainsString('max-age=600', $own->headers->get('Cache-Control'));

        foreach (['user', 'driver'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson("/api/driver/documents/{$doc->id}/file")->assertNotFound();
        }
        Sanctum::actingAs($this->user('admin'));   // verify-drivers
        $this->get("/api/driver/documents/{$doc->id}/file")->assertOk();
        $this->getJson('/api/driver/documents/999999/file')->assertNotFound();

        Storage::disk('local')->delete($doc->path);
        $this->getJson("/api/driver/documents/{$doc->id}/file")->assertNotFound();
    }

    public function test_document_reupload_replaces_the_file_and_approved_documents_are_locked(): void
    {
        $owner = $this->user('user');
        Sanctum::actingAs($owner);
        $this->pdf('selfie')->assertOk();
        $first = DriverDocument::first()->path;

        $payload = $this->pdf('selfie')->assertOk()->json();
        $doc = DriverDocument::first();
        $this->assertSame(1, DriverDocument::count());
        Storage::disk('local')->assertMissing($first);
        Storage::disk('local')->assertExists($doc->path);
        $selfie = collect($payload['documents'])->firstWhere('type', 'selfie');
        $this->assertSame(['type', 'required', 'status', 'rejection_reason', 'id', 'file_url', 'updated_at'], array_keys($selfie));
        $this->assertSame(url("/api/driver/documents/{$doc->id}/file"), $selfie['file_url']);

        $doc->forceFill(['status' => DriverDocument::STATUS_APPROVED])->save();
        $this->pdf('selfie')->assertStatus(409)->assertExactJson(['message' => 'This document is already approved.']);
        Storage::disk('local')->assertExists($doc->path);
        $this->post('/api/driver/documents', ['type' => 'passport'], ['Accept' => 'application/json'])->assertStatus(422);
    }

    // ── Onboarding ───────────────────────────────────────────────────────

    public function test_onboarding_payload_and_submit_refusals(): void
    {
        $user = $this->user('user');
        Sanctum::actingAs($user);

        $show = $this->getJson('/api/driver/onboarding')->assertOk()->assertJsonPath('status', 'draft')->assertJsonPath('can_submit', false);
        $this->assertSame(['status', 'can_submit', 'steps', 'services', 'rejection_reason', 'licence', 'documents'], array_keys($show->json()));

        $this->putJson('/api/driver/onboarding/services', ['services' => ['hire', 'hire']])->assertStatus(422);
        $this->putJson('/api/driver/onboarding/services', ['services' => ['hire']])->assertOk()->assertJsonPath('services', ['hire']);
        $this->putJson('/api/driver/onboarding/licence', ['licence_no' => 'X', 'licence_categories' => ['Z'], 'licence_expiry' => now()->addYear()->format('Y-m-d')])
            ->assertStatus(422)->assertJsonValidationErrors('licence_categories.0');
        $this->putJson('/api/driver/onboarding/licence', ['licence_no' => 'RW-9', 'licence_categories' => ['B', 'C1'], 'licence_expiry' => now()->addYear()->format('Y-m-d')])
            ->assertOk()->assertJsonPath('licence.licence_categories', ['B', 'C1']);

        Sanctum::actingAs($user = $user->fresh());   // a real request starts with a fresh user
        $this->postJson('/api/driver/onboarding/submit')->assertStatus(422)
            ->assertJsonPath('message', 'Complete every step before submitting.')
            ->assertJsonPath('errors.steps', ["Step 'documents' is not complete."]);

        $user->driverProfile->forceFill(['verification_status' => DriverProfile::STATUS_SUSPENDED])->save();
        $this->postJson('/api/driver/onboarding/submit')->assertStatus(409)->assertExactJson(['message' => 'Your driver account is suspended. Contact support.']);
        $user->driverProfile->forceFill(['verification_status' => DriverProfile::STATUS_VERIFIED])->save();
        $this->postJson('/api/driver/onboarding/submit')->assertStatus(409)->assertExactJson(['message' => 'You are already a verified driver.']);
    }

    // ── Verification ─────────────────────────────────────────────────────

    public function test_verification_guards_and_role_promotion(): void
    {
        $admin = $this->user('admin');
        $rider = $this->applicant('user');
        $staff = $this->applicant('admin');
        $draft = $this->user('user');
        $draft->driverProfile()->create(['services' => ['hire']]);
        Sanctum::actingAs($admin);

        $this->getJson("/api/admin/drivers/{$draft->id}")->assertNotFound();      // never submitted
        $this->getJson('/api/admin/drivers/999999')->assertNotFound();
        $detail = $this->getJson("/api/admin/drivers/{$rider->id}")->assertOk()->json();
        $this->assertSame(['user', 'status', 'submitted_at', 'verified_at', 'rejection_reason', 'services', 'licence', 'checklist', 'documents', 'vehicles', 'rates'], array_keys($detail));
        $this->assertSame('uploaded', collect($detail['documents'])->firstWhere('type', 'national_id')['status']);

        $this->postJson("/api/admin/drivers/{$rider->id}/verify")->assertOk()->assertJsonPath('user.role', 'driver');
        $this->postJson("/api/admin/drivers/{$staff->id}/verify")->assertOk()->assertJsonPath('user.role', 'admin');   // staff keep their role
        $this->postJson("/api/admin/drivers/{$rider->id}/reject", ['reason' => 'x'])->assertStatus(409)
            ->assertExactJson(['message' => 'Only pending applications can be rejected.']);
        $this->postJson("/api/admin/drivers/{$rider->id}/verify")->assertStatus(409)
            ->assertExactJson(['message' => 'Only pending applications can be approved.']);

        $selfApplicant = $admin;
        $selfApplicant->driverProfile()->create(['services' => ['hire']])->forceFill(['submitted_at' => now()])->save();
        $this->postJson("/api/admin/drivers/{$admin->id}/suspend", ['reason' => 'test'])->assertStatus(409)
            ->assertExactJson(['message' => 'You cannot suspend yourself.']);

        $this->postJson("/api/admin/drivers/{$draft->id}/warn", ['message' => 'Drive more carefully'])->assertOk();
        $this->assertSame('Drive more carefully', $draft->driverProfile->fresh()->warning);
        $this->postJson('/api/admin/drivers/' . $this->user('user')->id . '/warn', ['message' => 'Drive more carefully'])->assertNotFound();
        $this->assertDatabaseHas('activity_logs', ['action' => 'driver_warned', 'entity_id' => $draft->id]);
    }

    // ── Vehicles (Fleet) ─────────────────────────────────────────────────

    public function test_vehicle_activation_removal_and_moto_seats(): void
    {
        $driver = $this->user('user');
        Sanctum::actingAs($driver);
        $body = ['class' => 'car', 'model' => 'RAV4', 'seats' => 4, 'insurance_expiry' => now()->addYear()->format('Y-m-d')];

        $a = $this->postJson('/api/driver/vehicles', $body + ['plate' => ' rab  123a '])->assertCreated()
            ->assertJsonPath('plate', 'RAB 123A')->assertJsonPath('is_active', true)->json('id');
        $b = $this->postJson('/api/driver/vehicles', $body + ['plate' => 'RAC 1'])->assertCreated()->assertJsonPath('is_active', false)->json('id');
        $this->postJson('/api/driver/vehicles', ['class' => 'moto', 'model' => 'TVS', 'seats' => 3, 'plate' => 'RM 1', 'insurance_expiry' => '2030-01-01'])
            ->assertStatus(422)->assertExactJson(['message' => 'A moto can carry at most 2 people.', 'errors' => ['seats' => ['A moto can carry at most 2 people.']]]);

        $this->postJson("/api/driver/vehicles/$b/activate")->assertOk()->assertJsonPath('is_active', true);
        $this->assertFalse((bool) Vehicle::find($a)->is_active);
        $this->assertSame([$b, $a], array_column($this->getJson('/api/driver/vehicles')->json(), 'id'));

        Storage::disk('public')->put("vehicles/$a/front.jpg", 'x');
        Vehicle::find($a)->update(['photos' => ['front' => Storage::url("vehicles/$a/front.jpg")]]);
        Sanctum::actingAs($this->user('user'));
        $this->deleteJson("/api/driver/vehicles/$a")->assertNotFound();
        $this->postJson("/api/driver/vehicles/$a/activate")->assertNotFound();
        Sanctum::actingAs($driver);
        $this->deleteJson("/api/driver/vehicles/$a")->assertOk()->assertExactJson(['message' => 'Vehicle removed']);
        Storage::disk('public')->assertMissing("vehicles/$a/front.jpg");
        $this->assertNull(Vehicle::find($a));
    }

    public function test_setup_screen_creates_then_updates_the_active_vehicle(): void
    {
        $driver = $this->user('user');
        Sanctum::actingAs($driver);

        $this->patchJson('/api/driver/profile', ['car_model' => 'Hiace', 'plate' => 'rad 1 a', 'car_type' => 'Minivan', 'price_day' => 40000])
            ->assertOk()->assertJsonPath('vehicle.plate', 'RAD 1 A')->assertJsonPath('vehicle.class', 'van')
            ->assertJsonPath('vehicle.rental_price_day', 40000)->assertJsonPath('vehicle.is_active', true)
            ->assertJsonPath('profile.verification_status', 'pending');
        $this->patchJson('/api/driver/profile', ['car_type' => 'Sedan', 'allowed_zones' => ['Kigali']])->assertOk()
            ->assertJsonPath('vehicle.class', 'car')->assertJsonPath('profile.allowed_zones', ['Kigali'])->assertJsonCount(1, 'vehicles');
        $this->assertSame(['user', 'profile', 'vehicle', 'vehicles'], array_keys($this->getJson('/api/driver/profile')->json()));
    }
}
