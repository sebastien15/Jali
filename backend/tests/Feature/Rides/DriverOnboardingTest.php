<?php

namespace Tests\Feature\Rides;

use App\Models\DriverDocument;
use App\Models\DriverProfile;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

class DriverOnboardingTest extends TestCase
{
    use RefreshDatabase;

    private User $rider;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->rider = $this->user('user', '+250788000111');
    }

    private function user(string $role, ?string $phone = null): User
    {
        return User::create(['name' => ucfirst($role), 'phone' => $phone, 'role_id' => Role::where('name', $role)->value('id')]);
    }

    private function upload(string $type)
    {
        return $this->post('/api/driver/documents',
            ['type' => $type, 'file' => UploadedFile::fake()->image("$type.jpg")], ['Accept' => 'application/json']);
    }

    private function step(array $json, string $key): array
    {
        return collect($json['steps'])->firstWhere('key', $key);
    }

    private function completeRideApplication(): void
    {
        $this->putJson('/api/driver/onboarding/services', ['services' => ['ride']])->assertOk();
        $this->putJson('/api/driver/onboarding/licence', [
            'licence_no' => 'RW-123456', 'licence_categories' => ['B'], 'licence_expiry' => now()->addYear()->format('Y-m-d'),
        ])->assertOk();
        foreach (['licence_front', 'licence_back', 'national_id', 'selfie', 'insurance'] as $type) {
            $this->upload($type)->assertOk();
        }
        $vehicle = $this->postJson('/api/driver/vehicles', [
            'class' => 'car', 'model' => 'RAV4', 'plate' => 'RAB 123A', 'seats' => 4,
            'insurance_expiry' => now()->addMonths(6)->format('Y-m-d'),
        ])->json();
        $this->post("/api/driver/vehicles/{$vehicle['id']}/photos",
            ['slot' => 'front', 'photo' => UploadedFile::fake()->image('f.jpg')], ['Accept' => 'application/json'])->assertOk();
        $this->putJson('/api/driver/rates', ['base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500])->assertOk();
    }

    /** @test */
    public function a_rider_completes_every_step_and_submits_for_review()
    {
        Sanctum::actingAs($this->rider);

        $start = $this->getJson('/api/driver/onboarding')->assertOk()
            ->assertJsonPath('status', 'draft')->assertJsonPath('can_submit', false);
        OpenApiContract::assertResponse($start, 'get', '/driver/onboarding');

        $this->completeRideApplication();

        $ready = $this->getJson('/api/driver/onboarding')->assertJsonPath('can_submit', true)->json();
        foreach (['services', 'profile', 'licence', 'documents', 'vehicle', 'rates'] as $key) {
            $this->assertTrue($this->step($ready, $key)['done'], "step $key");
        }

        $submitted = $this->postJson('/api/driver/onboarding/submit')->assertOk()->assertJsonPath('status', 'pending');
        OpenApiContract::assertResponse($submitted, 'post', '/driver/onboarding/submit');
        $this->assertNotNull($this->rider->driverProfile->fresh()->submitted_at);
    }

    /** @test */
    public function submitting_an_incomplete_application_lists_the_missing_steps()
    {
        Sanctum::actingAs($this->rider);
        $this->putJson('/api/driver/onboarding/services', ['services' => ['ride']]);

        $response = $this->postJson('/api/driver/onboarding/submit')->assertStatus(422)->assertJsonValidationErrors(['steps']);
        OpenApiContract::assertResponse($response, 'post', '/driver/onboarding/submit');
        $this->assertStringContainsString('licence', implode(' ', $response->json('errors.steps')));
    }

    /** @test */
    public function hire_only_drivers_need_no_vehicle_insurance_or_rates()
    {
        Sanctum::actingAs($this->rider);
        $this->putJson('/api/driver/onboarding/services', ['services' => ['hire']])->assertOk();
        $this->putJson('/api/driver/onboarding/licence', [
            'licence_no' => 'RW-9', 'licence_categories' => ['B', 'C'], 'licence_expiry' => now()->addYear()->format('Y-m-d'),
        ])->assertOk();
        foreach (['licence_front', 'licence_back', 'national_id', 'selfie'] as $type) {
            $this->upload($type)->assertOk();
        }

        $json = $this->getJson('/api/driver/onboarding')->assertJsonPath('can_submit', true)->json();
        $this->assertFalse($this->step($json, 'vehicle')['required']);
        $this->assertFalse(collect($json['documents'])->firstWhere('type', 'insurance')['required']);
    }

    /** @test */
    public function an_expired_licence_is_rejected_with_a_clear_message()
    {
        Sanctum::actingAs($this->rider);

        $response = $this->putJson('/api/driver/onboarding/licence', [
            'licence_no' => 'RW-1', 'licence_categories' => ['B'], 'licence_expiry' => now()->subDay()->format('Y-m-d'),
        ])->assertStatus(422)
            ->assertJsonPath('errors.licence_expiry.0', 'Your driving licence has expired. Renew it before applying.');
        OpenApiContract::assertResponse($response, 'put', '/driver/onboarding/licence');
    }

    /** @test */
    public function documents_are_private_to_the_owner_and_driver_reviewers()
    {
        Sanctum::actingAs($this->rider);
        $uploaded = $this->upload('national_id')->assertOk();
        OpenApiContract::assertResponse($uploaded, 'post', '/driver/documents');
        $doc = DriverDocument::first();

        $this->assertStringStartsWith("driver-documents/{$this->rider->id}/", $doc->path);
        Storage::disk('local')->assertExists($doc->path);
        Storage::disk('public')->assertMissing($doc->path);
        $this->assertArrayNotHasKey('path', $doc->toArray());

        $this->get("/api/driver/documents/{$doc->id}/file")->assertOk();

        Sanctum::actingAs($this->user('user'));
        $this->getJson("/api/driver/documents/{$doc->id}/file")->assertNotFound();

        Sanctum::actingAs($this->user('admin'));   // has verify-drivers
        $this->get("/api/driver/documents/{$doc->id}/file")->assertOk();
    }

    /** @test */
    public function reuploading_a_rejected_document_sends_it_back_for_review()
    {
        Sanctum::actingAs($this->rider);
        $this->upload('selfie')->assertOk();
        DriverDocument::first()->update(['status' => 'rejected', 'rejection_reason' => 'Blurry']);

        $json = $this->getJson('/api/driver/onboarding')->json();
        $this->assertSame('rejected', collect($json['documents'])->firstWhere('type', 'selfie')['status']);
        $this->assertFalse($this->step($json, 'documents')['done']);

        $this->upload('selfie')->assertOk();
        $doc = DriverDocument::first();
        $this->assertSame('uploaded', $doc->status);
        $this->assertNull($doc->rejection_reason);
        $this->assertCount(1, Storage::disk('local')->allFiles("driver-documents/{$this->rider->id}"));
    }

    /** @test */
    public function a_rejected_applicant_can_fix_and_resubmit_but_verified_drivers_cannot()
    {
        Sanctum::actingAs($this->rider);
        $this->completeRideApplication();
        $this->postJson('/api/driver/onboarding/submit')->assertOk();

        $this->rider->driverProfile->forceFill(['verification_status' => 'rejected', 'rejection_reason' => 'Licence photo unreadable'])->save();
        $this->getJson('/api/driver/onboarding')
            ->assertJsonPath('status', 'rejected')->assertJsonPath('rejection_reason', 'Licence photo unreadable');

        $this->postJson('/api/driver/onboarding/submit')->assertOk()->assertJsonPath('status', 'pending')
            ->assertJsonPath('rejection_reason', null);

        $this->rider->driverProfile->forceFill(['verification_status' => DriverProfile::STATUS_VERIFIED])->save();
        $this->postJson('/api/driver/onboarding/submit')->assertStatus(409);
    }
}
