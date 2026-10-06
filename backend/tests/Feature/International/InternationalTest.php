<?php

namespace Tests\Feature\International;

use App\Mail\TripReceipt;
use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\Role;
use App\Models\User;
use App\Modules\Payments\Application\ExchangeRates;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** Epic E9 — chat (S9.5), currency (S9.4), receipts (S9.6), Apple sign-in route (S9.3) */
class InternationalTest extends TestCase
{
    use RefreshDatabase;

    private User $rider;
    private User $driver;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([
            PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']]),
            // First call succeeds, later calls find the source down
            ExchangeRates::SOURCE => Http::sequence()
                ->push(['result' => 'success', 'rates' => ['USD' => 0.00071, 'EUR' => 0.00065, 'GBP' => 0.00056, 'KES' => 0.092, 'JPY' => 0.1]])
                ->whenEmpty(Http::response('down', 503)),
        ]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(now()->setTimezone('Africa/Kigali')->setTime(14, 0)->utc());
        $this->rider = User::create(['name' => 'Emma Smith', 'email' => 'emma@example.com', 'phone' => '+447700900123', 'role_id' => Role::where('name', 'user')->value('id')]);
        $this->driver = User::create(['name' => 'Jean Paul', 'phone' => '+250788222222', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $this->driver->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified'])->save();
        $vehicle = $this->driver->vehicles()->create(['model' => 'RAV4', 'make' => 'Toyota', 'plate' => 'RAB 123A', 'class' => 'car',
            'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear()]);
        DriverRate::create(['user_id' => $this->driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500]);
        DriverPresence::create(['user_id' => $this->driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => -1.945, 'lng' => 30.063, 'last_seen_at' => now(), 'online_since' => now()]);
    }

    private function ride(): int
    {
        Sanctum::actingAs($this->rider);

        return $this->postJson('/api/rides', ['mode' => 'pick', 'driver_id' => $this->driver->id,
            'pickup' => ['lat' => -1.9441, 'lng' => 30.0619, 'address' => 'Kigali Marriott'], 'dropoff' => ['lat' => -1.95, 'lng' => 30.125, 'address' => 'Kigali Convention Centre']])
            ->assertCreated()->json('id');
    }

    /** @test */
    public function chat_opens_after_accept_sends_phrases_and_text_and_blocks_contact_details()
    {
        $id = $this->ride();
        $this->postJson("/api/rides/$id/messages", ['phrase' => 'i_am_here'])->assertStatus(409);   // not accepted yet

        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/$id/accept")->assertOk();
        OpenApiContract::assertResponse($this->postJson("/api/rides/$id/messages", ['phrase' => 'on_my_way'])->assertCreated(), 'post', '/rides/{id}/messages');

        Sanctum::actingAs($this->rider);
        $this->postJson("/api/rides/$id/messages", ['body' => "I'm wearing a red jacket"])->assertCreated()->assertJsonPath('mine', true);
        foreach (['call me on 0788 123 456', 'see www.example.com', 'https://evil.link/x', 'mail me@test.com'] as $bad) {
            $this->postJson("/api/rides/$id/messages", ['body' => $bad])->assertStatus(422)->assertJsonValidationErrors('body');
        }
        $this->postJson("/api/rides/$id/messages", ['phrase' => 'not_a_phrase'])->assertStatus(422);

        $list = $this->getJson("/api/rides/$id/messages")->assertOk()->assertJsonPath('open', true)->assertJsonCount(2, 'messages')
            ->assertJsonPath('messages.0.phrase', 'on_my_way')->assertJsonPath('messages.0.mine', false);
        OpenApiContract::assertResponse($list, 'get', '/rides/{id}/messages');
        $after = $list->json('messages.0.id');
        $this->getJson("/api/rides/$id/messages?after_id=$after")->assertJsonCount(1, 'messages');

        Sanctum::actingAs(User::create(['name' => 'Stranger', 'role_id' => Role::where('name', 'user')->value('id')]));
        $this->getJson("/api/rides/$id/messages")->assertNotFound();
    }

    /** @test */
    public function fx_rates_are_fetched_once_a_day_and_hidden_when_stale()
    {
        Sanctum::actingAs($this->rider);
        $res = $this->getJson('/api/fx/rates')->assertOk()->assertJsonPath('stale', false)->assertJsonPath('rates.USD', 0.00071);
        OpenApiContract::assertResponse($res, 'get', '/fx/rates');
        $this->assertNull($res->json('rates.JPY'));
        $this->getJson('/api/fx/rates')->assertJsonPath('rates.USD', 0.00071);   // cached, no second fetch the same day

        // Source down for 4 days → stale, conversion hidden
        $this->travel(4)->days();
        $this->getJson('/api/fx/rates')->assertJsonPath('stale', true)->assertJsonPath('rates', null);
    }

    /** @test */
    public function a_receipt_is_emailed_on_completion_and_can_be_opened_and_resent()
    {
        Mail::fake();
        $id = $this->ride();
        $pin = Ride::find($id)->start_pin;
        $this->postJson("/api/rides/$id/receipt")->assertStatus(409);   // not finished

        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/$id/accept")->assertOk();
        $this->postJson("/api/rides/$id/arrive")->assertOk();
        $this->postJson("/api/rides/$id/start", ['pin' => $pin])->assertOk();
        $this->postJson("/api/rides/$id/complete", ['payment_method' => 'cash'])->assertOk();
        Mail::assertSent(TripReceipt::class, fn ($m) => $m->hasTo('emma@example.com') && $m->receipt['number'] === "R-$id");

        Sanctum::actingAs($this->rider);
        $res = $this->postJson("/api/rides/$id/receipt", ['email' => true])->assertOk()->assertJsonPath('emailed', true);
        OpenApiContract::assertResponse($res, 'post', '/rides/{id}/receipt');
        $this->get($res->json('url'))->assertOk()->assertSee("R-$id")->assertSee('RAB 123A')->assertSee('Kigali Convention Centre');
        $this->get(route('receipt', ['type' => 'ride', 'id' => $id]))->assertForbidden();   // unsigned link

        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/$id/receipt")->assertNotFound();   // the rider's receipt
    }

    /** @test */
    public function apple_sign_in_requires_a_firebase_token()
    {
        $this->postJson('/api/auth/login/apple', [])->assertStatus(422);
        $this->postJson('/api/auth/login/apple', ['firebase_token' => 'not-a-token'])->assertStatus(401);
    }
}
