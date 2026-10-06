<?php

namespace Tests\Feature\Rentals;

use App\Models\CarRental;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** Rental car registration: full listing, photos, owner rules, papers and verification (S24.8). */
class RentalCarRegistrationTest extends TestCase
{
    use RefreshDatabase, RentalTestHelpers;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRentals();
    }

    /** @test */
    public function owner_lists_a_car_with_full_details_and_rules_and_it_waits_for_review()
    {
        Sanctum::actingAs($this->owner);
        $res = $this->postJson('/api/driver/cars', $this->carPayload());
        OpenApiContract::assertResponse($res, 'post', '/driver/cars');
        $car = $res->assertCreated()
            ->assertJsonPath('name', 'Toyota RAV4')
            ->assertJsonPath('plate', 'RAD 123 B')
            ->assertJsonPath('priceDay', 50000)
            ->assertJsonPath('transmission', 'automatic')
            ->assertJsonPath('rules.1', 'No off-road driving in the rainy season')
            ->assertJsonPath('allowed.pets', true)
            ->assertJsonPath('allowed.smoking', false)
            ->assertJsonPath('verification_status', 'pending')
            ->assertJsonPath('documents.registration', false)
            ->assertJsonPath('listing_complete', false)
            ->json();
        $this->assertEqualsCanonicalizing(['photos', 'registration', 'insurance'], $car['missing']);

        // Pending cars are invisible to customers in both catalogues
        Sanctum::actingAs($this->customer);
        $this->assertSame([], $this->getJson('/api/rentals/cars')->assertOk()->json('data'));
        $this->assertNotContains($car['id'], array_column($this->getJson('/api/car-rentals')->json(), 'id'));
        $this->getJson("/api/rentals/cars/{$car['id']}")->assertNotFound();
    }

    /** @test */
    public function owner_adds_photos_and_papers_reorders_and_removes_photos()
    {
        Sanctum::actingAs($this->owner);
        $id = $this->postJson('/api/driver/cars', $this->carPayload())->json('id');

        foreach (['front.jpg', 'side.jpg', 'inside.jpg'] as $name) {
            $this->post("/api/driver/cars/$id/photos", ['photo' => $this->image($name)], ['Accept' => 'application/json'])->assertOk();
        }
        $photos = CarRental::find($id)->photos;
        $this->assertCount(3, $photos);
        Storage::disk('public')->assertExists(substr($photos[0], strlen(Storage::url(''))));

        $this->postJson("/api/driver/cars/$id/photos/2/cover")->assertOk()->assertJsonPath('photos.0', $photos[2]);
        $this->deleteJson("/api/driver/cars/$id/photos/1")->assertOk()->assertJsonCount(2, 'photos');
        $this->post("/api/driver/cars/$id/photos", ['photo' => $this->image('back.jpg')], ['Accept' => 'application/json'])->assertOk();

        $this->post("/api/driver/cars/$id/documents", ['type' => 'registration', 'file' => UploadedFile::fake()->create('yellow-card.pdf', 200, 'application/pdf')],
            ['Accept' => 'application/json'])->assertOk()->assertJsonPath('documents.registration', true);
        $this->post("/api/driver/cars/$id/documents", ['type' => 'insurance', 'file' => $this->image('insurance.jpg')],
            ['Accept' => 'application/json'])->assertOk()->assertJsonPath('documents.insurance', true)
            ->assertJsonPath('listing_complete', true)->assertJsonPath('missing', []);
        $this->post("/api/driver/cars/$id/documents", ['type' => 'passport', 'file' => $this->image()], ['Accept' => 'application/json'])
            ->assertStatus(422);

        // The owner can read back their own papers; nobody else can
        $this->get("/api/driver/cars/$id/documents/registration")->assertOk();
        Sanctum::actingAs($this->person('Other Owner', '+250788300300', 'driver'));
        $this->get("/api/driver/cars/$id/documents/registration")->assertNotFound();
        $this->deleteJson("/api/driver/cars/$id/photos/0")->assertNotFound();
    }

    /** @test */
    public function admin_verifies_complete_listings_and_rejects_with_a_note()
    {
        Sanctum::actingAs($this->owner);
        $id = $this->postJson('/api/driver/cars', $this->carPayload())->json('id');

        Sanctum::actingAs($this->admin);
        OpenApiContract::assertResponse($this->getJson('/api/admin/rental-cars'), 'get', '/admin/rental-cars');
        $this->getJson('/api/admin/rental-cars')->assertOk()->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.owner.phone', '+250788200200');
        $this->postJson("/api/admin/rental-cars/$id/review", ['decision' => 'approve'])->assertStatus(409);
        $this->postJson("/api/admin/rental-cars/$id/review", ['decision' => 'reject'])->assertStatus(422);
        $this->postJson("/api/admin/rental-cars/$id/review", ['decision' => 'reject', 'note' => 'Photos are blurry'])->assertOk()
            ->assertJsonPath('verification_status', 'rejected');

        // Fixing a rejected listing sends it back for review
        Sanctum::actingAs($this->owner);
        $this->getJson('/api/driver/cars')->assertJsonPath('0.verification_note', 'Photos are blurry');
        $this->patchJson("/api/driver/cars/$id", ['description' => 'New sharp photos added'])->assertOk()
            ->assertJsonPath('verification_status', 'pending');
        foreach ([1, 2, 3] as $n) {
            $this->post("/api/driver/cars/$id/photos", ['photo' => $this->image("$n.jpg")], ['Accept' => 'application/json']);
        }
        foreach (['registration', 'insurance'] as $type) {
            $this->post("/api/driver/cars/$id/documents", ['type' => $type, 'file' => $this->image()], ['Accept' => 'application/json']);
        }

        Sanctum::actingAs($this->admin);
        $this->get("/api/admin/rental-cars/$id/documents/insurance")->assertOk();
        $this->postJson("/api/admin/rental-cars/$id/review", ['decision' => 'approve'])->assertOk()
            ->assertJsonPath('verification_status', 'verified');
        $this->assertDatabaseHas('activity_logs', ['action' => 'rental_car.verified', 'entity_id' => $id]);

        // Live for customers, without private papers or review notes
        Sanctum::actingAs($this->customer);
        $car = $this->getJson("/api/rentals/cars/$id")->assertOk()
            ->assertJsonPath('terms.rules.0', 'Return the car washed')
            ->assertJsonPath('terms.allowed.pets', true)
            ->assertJsonPath('owner.first_name', 'Eric')
            ->json();
        $this->assertArrayNotHasKey('documents', $car);
        $this->assertArrayNotHasKey('plate', $car);
        $this->assertArrayNotHasKey('documents', $this->getJson('/api/car-rentals')->json('0'));

        // A new plate is a new car to check
        Sanctum::actingAs($this->owner);
        $this->patchJson("/api/driver/cars/$id", ['plate' => 'RAE 999 C'])->assertOk()->assertJsonPath('verification_status', 'pending');
    }

    /** @test */
    public function validation_plates_and_permissions()
    {
        Sanctum::actingAs($this->owner);
        $this->postJson('/api/driver/cars', $this->carPayload(['type' => 'Boat', 'transmission' => 'cvt', 'rules' => array_fill(0, 16, 'Rule text')]))
            ->assertStatus(422)->assertJsonValidationErrors(['type', 'transmission', 'rules']);
        $this->postJson('/api/driver/cars', $this->carPayload(['max_days' => 2, 'min_days' => 5]))->assertStatus(422)->assertJsonValidationErrors(['max_days']);
        $this->postJson('/api/driver/cars', $this->carPayload())->assertCreated();
        $this->postJson('/api/driver/cars', $this->carPayload(['plate' => 'RAD123B ']))->assertCreated();   // spacing differs: different plate string
        $this->postJson('/api/driver/cars', $this->carPayload())->assertStatus(422)->assertJsonValidationErrors(['plate']);

        Sanctum::actingAs($this->customer);
        $this->postJson('/api/driver/cars', $this->carPayload(['plate' => 'RAF 1']))->assertForbidden();
        $this->getJson('/api/admin/rental-cars')->assertForbidden();
        Sanctum::actingAs($this->owner);
        $this->getJson('/api/admin/rental-cars')->assertForbidden();
    }

    /** @test */
    public function owner_blocks_days_and_cannot_delete_a_car_with_open_rentals()
    {
        $car = $this->verifiedCar();
        Sanctum::actingAs($this->owner);
        $block = $this->postJson("/api/driver/cars/{$car->id}/blocks", ['start_date' => '2026-10-20', 'end_date' => '2026-10-22', 'reason' => 'Service'])
            ->assertCreated()->json('id');
        OpenApiContract::assertResponse($this->getJson("/api/driver/cars/{$car->id}"), 'get', '/driver/cars/{id}');
        $this->getJson("/api/driver/cars/{$car->id}")->assertOk()->assertJsonPath('blocks.0.reason', 'Service')
            ->assertJsonPath('busy.0.kind', 'blocked');
        $this->postJson("/api/driver/cars/{$car->id}/blocks", ['start_date' => '2026-10-01', 'end_date' => '2026-10-02'])->assertStatus(422);

        Sanctum::actingAs($this->customer);
        $this->postJson('/api/rentals/bookings', [
            'car_id' => $car->id, 'start_at' => $this->kigali('2026-10-14 09:00'), 'end_at' => $this->kigali('2026-10-16 09:00'),
            'pickup_method' => 'pickup', 'payment_method' => 'cash', 'accept_terms' => true, 'driver_confirmed' => true,
        ])->assertCreated();

        Sanctum::actingAs($this->owner);
        $this->postJson("/api/driver/cars/{$car->id}/blocks", ['start_date' => '2026-10-15', 'end_date' => '2026-10-15'])->assertStatus(409);
        $this->deleteJson("/api/driver/cars/{$car->id}")->assertStatus(409);
        $this->deleteJson("/api/driver/cars/{$car->id}/blocks/$block")->assertNoContent();
    }
}
