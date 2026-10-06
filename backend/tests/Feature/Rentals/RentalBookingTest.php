<?php

namespace Tests\Feature\Rentals;

use App\Models\CarRental;
use App\Models\RentalBooking;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** Car rental bookings: search by dates, price, request, confirm, cancel, handover, return, ratings (S24.1–S24.7, S24.9). */
class RentalBookingTest extends TestCase
{
    use RefreshDatabase, RentalTestHelpers;

    private CarRental $car;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRentals();
        $this->car = $this->verifiedCar();
    }

    private function request(array $overrides = [])
    {
        return $this->postJson('/api/rentals/bookings', array_merge([
            'car_id' => $this->car->id,
            'start_at' => $this->kigali('2026-10-14 09:00'), 'end_at' => $this->kigali('2026-10-21 09:00'),
            'pickup_method' => 'pickup', 'payment_method' => 'momo', 'note' => 'Going to Akagera',
            'accept_terms' => true, 'driver_confirmed' => true,
        ], $overrides));
    }

    /** @test */
    public function customer_searches_by_dates_and_sees_the_owners_price_with_no_jali_fee()
    {
        $this->verifiedCar(['plate' => 'RAB 1', 'name' => 'Suzuki Swift', 'make' => 'Suzuki', 'model' => 'Swift', 'type' => 'Hatchback', 'price' => 25000, 'transmission' => 'manual']);
        $this->verifiedCar(['plate' => 'RAB 2', 'name' => 'Pending car', 'verification_status' => CarRental::PENDING]);
        $this->verifiedCar(['plate' => 'RAB 3', 'name' => 'In the garage', 'status' => 'maintenance']);
        $this->verifiedCar(['plate' => 'RAB 5', 'name' => 'Seeded demo car', 'user_id' => null]);   // no owner to confirm
        $this->verifiedCar(['plate' => 'RAB 4', 'name' => 'Blocked', 'make' => 'Honda', 'model' => 'Fit', 'price' => 30000])->blocks()->create(['start_date' => '2026-10-18', 'end_date' => '2026-10-19']);

        Sanctum::actingAs($this->customer);
        $res = $this->getJson('/api/rentals/cars?start_at=' . urlencode($this->kigali('2026-10-14 09:00')) . '&end_at=' . urlencode($this->kigali('2026-10-21 09:00')))
            ->assertOk();
        OpenApiContract::assertResponse($res, 'get', '/rentals/cars');
        $this->assertSame(['Suzuki Swift', 'Toyota RAV4'], array_column($res->json('data'), 'name'));
        $res->assertJsonPath('data.1.quote.days', 7)
            ->assertJsonPath('data.1.quote.base', 350000)
            ->assertJsonPath('data.1.quote.discount_pct', 10)
            ->assertJsonPath('data.1.quote.total', 315000)
            ->assertJsonPath('data.1.quote.jali_fee', 0)
            ->assertJsonPath('data.1.quote.deposit', 200000);

        $this->getJson('/api/rentals/cars?transmission=manual')->assertJsonCount(1, 'data');
        $this->getJson('/api/rentals/cars?q=rav')->assertJsonCount(1, 'data');

        // Detail: calendar, terms and a delivery quote
        $detail = $this->getJson("/api/rentals/cars/{$this->car->id}?pickup_method=delivery&start_at=" . urlencode($this->kigali('2026-10-14 09:00')) . '&end_at=' . urlencode($this->kigali('2026-10-15 12:00')));
        OpenApiContract::assertResponse($detail, 'get', '/rentals/cars/{id}');
        $detail->assertOk()->assertJsonPath('quote.days', 2)->assertJsonPath('quote.delivery_fee', 10000)
            ->assertJsonPath('quote.total', 110000)->assertJsonPath('available', true)
            ->assertJsonPath('terms.mileage_limit_km', 200);
    }

    /** @test */
    public function request_holds_the_dates_and_rules_are_enforced()
    {
        Sanctum::actingAs($this->customer);
        $this->request(['accept_terms' => false])->assertStatus(422)->assertJsonValidationErrors(['accept_terms']);
        $this->request(['start_at' => $this->kigali('2026-10-12 12:00')])->assertStatus(422);   // under 12 h notice
        $this->request(['end_at' => $this->kigali('2026-12-14 09:00')])->assertStatus(422);     // over max 30 days

        $created = $this->request();
        OpenApiContract::assertResponse($created, 'post', '/rentals/bookings');
        $booking = $created->assertCreated()
            ->assertJsonPath('status', 'requested')->assertJsonPath('total', 315000)
            ->assertJsonPath('owner.phone', null)->assertJsonPath('car.plate', null)
            ->json();
        Http::assertSent(fn ($r) => str_contains(json_encode($r->data()), 'New rental request'));

        // Same dates: the car is taken for everyone else, and the search hides it
        $other = $this->person('Jean Mugisha', '+250788400400', 'user');
        Sanctum::actingAs($other);
        $this->request(['start_at' => $this->kigali('2026-10-20 09:00'), 'end_at' => $this->kigali('2026-10-23 09:00')])->assertStatus(409);
        $this->getJson('/api/rentals/cars?start_at=' . urlencode($this->kigali('2026-10-15 09:00')) . '&end_at=' . urlencode($this->kigali('2026-10-16 09:00')))
            ->assertJsonCount(0, 'data');
        $this->request(['start_at' => $this->kigali('2026-10-21 10:00'), 'end_at' => $this->kigali('2026-10-23 09:00')])->assertCreated();

        // The owner can't rent their own car; strangers can't see the booking
        Sanctum::actingAs($this->owner);
        $this->request()->assertStatus(422);
        $this->getJson("/api/rentals/bookings/{$booking['id']}")->assertNotFound();

        // Unanswered requests expire and free the dates
        $this->travel(13)->hours();
        Artisan::call('rentals:expire-requests');
        $this->assertSame('expired', RentalBooking::find($booking['id'])->status);
    }

    /** @test */
    public function owner_accepts_hands_over_and_takes_back_with_late_and_extra_km_charges()
    {
        Sanctum::actingAs($this->customer);
        $id = $this->request()->json('id');

        Sanctum::actingAs($this->owner);
        $this->getJson('/api/driver/rentals?status=requested')->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.customer.phone', null)->assertJsonPath('data.0.can_accept', true);
        $summary = $this->getJson('/api/driver/rentals/summary')->assertJsonPath('requests', 1);
        OpenApiContract::assertResponse($summary, 'get', '/driver/rentals/summary');
        OpenApiContract::assertResponse($this->getJson('/api/driver/rentals'), 'get', '/driver/rentals');
        $this->postJson("/api/driver/rentals/$id/accept")->assertOk()->assertJsonPath('status', 'accepted')
            ->assertJsonPath('customer.phone', '+250788100100');
        $this->postJson("/api/driver/rentals/$id/accept")->assertStatus(409);
        $this->post("/api/driver/rentals/$id/handover", ['odometer_km' => 45000, 'fuel_level' => 8], ['Accept' => 'application/json'])
            ->assertStatus(409);   // more than 24 h before pickup

        Sanctum::actingAs($this->customer);
        $this->getJson("/api/rentals/bookings/$id")->assertJsonPath('owner.phone', '+250788200200')
            ->assertJsonPath('car.plate', 'RAD 123 B')
            ->assertJsonPath('cancel_fee_now', 157500);   // moderate policy, under 3 days before pickup: half

        // Handover at pickup with photos
        $this->travelTo(Carbon::parse('2026-10-14 08:50', 'Africa/Kigali')->utc());
        Sanctum::actingAs($this->owner);
        $this->post("/api/driver/rentals/$id/handover", [
            'odometer_km' => 45000, 'fuel_level' => 8, 'notes' => 'Small scratch on rear bumper',
            'photos' => [$this->image('front.jpg'), $this->image('rear.jpg')],
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('status', 'active')
            ->assertJsonPath('handover.odometer_km', 45000)->assertJsonCount(2, 'handover.photos');

        // Returned almost a day late (23.5 h → 1 day) with 1,800 km driven (limit 7 × 200 = 1,400 km) and a cleaning charge
        $this->travelTo(Carbon::parse('2026-10-22 08:30', 'Africa/Kigali')->utc());
        $this->post("/api/driver/rentals/$id/return", ['odometer_km' => 44000, 'fuel_level' => 6], ['Accept' => 'application/json'])
            ->assertStatus(422);
        $res = $this->post("/api/driver/rentals/$id/return", [
            'odometer_km' => 46800, 'fuel_level' => 6, 'other_charges' => [['label' => 'Cleaning', 'amount' => 5000]],
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('status', 'completed');
        OpenApiContract::assertResponse($res, 'post', '/driver/rentals/{id}/return');
        $charges = collect($res->json('extra_charges'))->keyBy('type');
        $this->assertSame(50000, $charges['late_return']['amount']);
        $this->assertSame(400 * 300, $charges['extra_km']['amount']);
        $res->assertJsonPath('final_total', 315000 + 50000 + 120000 + 5000);
        $this->assertSame(1, CarRental::find($this->car->id)->trips_count);

        // Both rate; the car's rating follows customer ratings
        $this->postJson("/api/driver/rentals/$id/rate", ['stars' => 5])->assertCreated();
        Sanctum::actingAs($this->customer);
        $this->postJson("/api/rentals/bookings/$id/rate", ['stars' => 4, 'comment' => 'Great car'])->assertCreated()
            ->assertJsonPath('my_rating', 4);
        $this->postJson("/api/rentals/bookings/$id/rate", ['stars' => 5])->assertStatus(409);
        $this->assertSame(4.0, (float) CarRental::find($this->car->id)->rating);
        $this->getJson('/api/rentals/bookings?scope=past')->assertJsonPath('data.0.id', $id);

        Sanctum::actingAs($this->owner);
        $this->getJson('/api/driver/rentals/summary')->assertJsonPath('completed_rentals', 1)
            ->assertJsonPath('income_this_month', 490000)->assertJsonPath('per_car.0.trips', 1);
    }

    /** @test */
    public function cancellations_follow_the_owners_policy()
    {
        Sanctum::actingAs($this->customer);
        $free = $this->request()->json('id');
        $this->postJson("/api/rentals/bookings/$free/cancel", ['reason' => 'changed_plans'])->assertOk()
            ->assertJsonPath('status', 'cancelled')->assertJsonPath('cancel_fee', 0);

        // Accepted, then cancelled 2 days before pickup: moderate policy → half the total
        $late = $this->request(['start_at' => $this->kigali('2026-10-14 09:00'), 'end_at' => $this->kigali('2026-10-16 09:00')])->json('id');
        Sanctum::actingAs($this->owner);
        $this->postJson("/api/driver/rentals/$late/accept")->assertOk();
        Sanctum::actingAs($this->customer);
        $this->getJson("/api/rentals/bookings/$late")->assertJsonPath('cancel_fee_now', 50000);
        $this->postJson("/api/rentals/bookings/$late/cancel", ['reason' => 'nope'])->assertStatus(422);
        $this->postJson("/api/rentals/bookings/$late/cancel", ['reason' => 'found_another_car'])->assertOk()
            ->assertJsonPath('cancel_fee', 50000);

        // Owner declines one request and cancels another accepted one (no fee for the customer)
        $declined = $this->request(['start_at' => $this->kigali('2026-10-24 09:00'), 'end_at' => $this->kigali('2026-10-25 09:00')])->json('id');
        $cancelled = $this->request(['start_at' => $this->kigali('2026-10-26 09:00'), 'end_at' => $this->kigali('2026-10-27 09:00')])->json('id');
        Sanctum::actingAs($this->owner);
        $this->postJson("/api/driver/rentals/$declined/decline", ['reason' => 'Car booked elsewhere'])->assertOk()->assertJsonPath('status', 'declined');
        $this->postJson("/api/driver/rentals/$cancelled/cancel", ['reason' => 'car_broke_down'])->assertStatus(409);
        $this->postJson("/api/driver/rentals/$cancelled/accept")->assertOk();
        $this->postJson("/api/driver/rentals/$cancelled/cancel", ['reason' => 'car_broke_down'])->assertOk()
            ->assertJsonPath('cancelled_by', 'owner')->assertJsonPath('cancel_fee', 0);
    }

    /** @test */
    public function admins_see_all_rentals_with_contacts()
    {
        Sanctum::actingAs($this->customer);
        $id = $this->request()->json('id');
        $this->getJson('/api/admin/rentals')->assertForbidden();

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/admin/rentals?status=requested')->assertOk()->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.customer.phone', '+250788100100')->assertJsonPath('data.0.owner.phone', '+250788200200');
        OpenApiContract::assertResponse($this->getJson('/api/admin/rentals'), 'get', '/admin/rentals');
        $this->getJson("/api/admin/rentals/$id")->assertOk()->assertJsonPath('terms.rules.0', 'Return the car washed');
    }
}
