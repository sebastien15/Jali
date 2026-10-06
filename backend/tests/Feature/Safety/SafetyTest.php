<?php

namespace Tests\Feature\Safety;

use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\RideRating;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use App\Modules\Notifications\Infrastructure\SmsService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** Epic E8 — share my trip (S8.1), SOS (S8.2), drivers needing review (S8.4) */
class SafetyTest extends TestCase
{
    use RefreshDatabase;

    private User $rider;
    private User $driver;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([
            PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']]),
            SmsService::AFRICASTALKING_ENDPOINT => Http::response(['SMSMessageData' => ['Recipients' => [['status' => 'Success']]]]),
        ]);
        config(['services.sms.driver' => 'africastalking', 'services.sms.africastalking' => ['username' => 'jali', 'api_key' => 'k', 'sender_id' => null]]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(now()->setTimezone('Africa/Kigali')->setTime(14, 0)->utc());
        $this->rider = User::create(['name' => 'Aline Mukamana', 'phone' => '+250788111111', 'role_id' => Role::where('name', 'user')->value('id')]);
        $this->admin = User::create(['name' => 'Ops', 'email' => 'ops@jali.rw', 'fcm_token' => 'ExponentPushToken[ops]', 'role_id' => Role::where('name', 'admin')->value('id')]);
        $this->driver = User::create(['name' => 'Jean Paul Habimana', 'phone' => '+250788222222', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $this->driver->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified'])->save();
        $vehicle = $this->driver->vehicles()->create(['model' => 'RAV4', 'make' => 'Toyota', 'color' => 'White', 'plate' => 'RAB 123A', 'class' => 'car',
            'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear()]);
        DriverRate::create(['user_id' => $this->driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500]);
        DriverPresence::create(['user_id' => $this->driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => -1.94512, 'lng' => 30.06309, 'last_seen_at' => now(), 'online_since' => now()]);
    }

    private function acceptedRide(): int
    {
        Sanctum::actingAs($this->rider);
        $id = $this->postJson('/api/rides', ['mode' => 'pick', 'driver_id' => $this->driver->id,
            'pickup' => ['lat' => -1.9441, 'lng' => 30.0619, 'address' => 'KN 3 Rd'], 'dropoff' => ['lat' => -1.95, 'lng' => 30.125, 'address' => 'Kimironko']])
            ->assertCreated()->json('id');
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/$id/accept")->assertOk();

        return $id;
    }

    /** @test */
    public function rider_shares_a_live_link_that_shows_first_names_only_and_stops_when_the_ride_ends()
    {
        $id = $this->acceptedRide();
        Sanctum::actingAs($this->rider);
        $res = $this->postJson("/api/rides/$id/share")->assertOk();
        OpenApiContract::assertResponse($res, 'post', '/rides/{id}/share');
        $token = basename($res->json('url'));
        $this->assertSame($res->json('url'), $this->postJson("/api/rides/$id/share")->json('url'));   // same link twice

        $this->app['auth']->forgetGuards();
        $public = $this->getJson("/api/share/$token")->assertOk()
            ->assertJsonPath('rider.first_name', 'Aline')
            ->assertJsonPath('driver.name', 'Jean H.')
            ->assertJsonPath('vehicle.plate', 'RAB 123A')
            ->assertJsonPath('position.lat', -1.945);
        OpenApiContract::assertResponse($public, 'get', '/share/{token}');
        $this->assertStringNotContainsString('+250', $public->getContent());
        $this->get("/t/$token")->assertOk()->assertSee('Jali');

        Sanctum::actingAs($this->rider);
        $this->postJson("/api/rides/$id/cancel", ['reason' => 'changed_plans'])->assertOk();
        $this->app['auth']->forgetGuards();
        OpenApiContract::assertResponse($this->getJson("/api/share/$token")->assertStatus(410), 'get', '/share/{token}');
        $this->getJson('/api/share/' . str_repeat('x', 40))->assertNotFound();
    }

    /** @test */
    public function strangers_cannot_share_or_sos_someone_elses_ride()
    {
        $id = $this->acceptedRide();
        Sanctum::actingAs(User::create(['name' => 'Stranger', 'role_id' => Role::where('name', 'user')->value('id')]));
        $this->postJson("/api/rides/$id/share")->assertNotFound();
        $this->postJson("/api/rides/$id/sos")->assertNotFound();
    }

    /** @test */
    public function sos_flags_the_ride_alerts_admins_and_texts_the_emergency_contact()
    {
        Sanctum::actingAs($this->rider);
        $this->putJson('/api/me/emergency-contact', ['name' => 'Mama', 'phone' => 'abc'])->assertStatus(422);
        OpenApiContract::assertResponse($this->putJson('/api/me/emergency-contact', ['name' => 'Mama', 'phone' => '+250788999999'])->assertOk(),
            'put', '/me/emergency-contact');
        OpenApiContract::assertResponse($this->getJson('/api/me/emergency-contact')->assertJsonPath('name', 'Mama'), 'get', '/me/emergency-contact');

        $id = $this->acceptedRide();
        Sanctum::actingAs($this->rider);
        $res = $this->postJson("/api/rides/$id/sos", ['lat' => -1.944, 'lng' => 30.062])->assertOk()
            ->assertJsonPath('flagged', true)->assertJsonPath('emergency_contact_notified', true)->assertJsonPath('call', '112');
        OpenApiContract::assertResponse($res, 'post', '/rides/{id}/sos');

        $ride = Ride::find($id);
        $this->assertNotNull($ride->sos_at);
        $this->assertNotNull($ride->flagged_at);
        Http::assertSent(fn ($r) => str_contains($r->url(), 'africastalking') && $r['to'] === '+250788999999' && str_contains($r['message'], '/t/'));
        Http::assertSent(fn ($r) => ($r['to'] ?? null) === 'ExponentPushToken[ops]' && str_contains($r['title'], 'SOS'));

        // Admins see it as a flagged ride
        Sanctum::actingAs($this->admin);
        $this->getJson('/api/admin/rides?flagged=1')->assertJsonPath('data.0.id', $id);
        $this->assertContains('sos', array_column($this->getJson("/api/admin/rides/$id")->json('timeline'), 'type'));
    }

    /** @test */
    public function low_rated_and_high_cancel_drivers_need_review_and_can_be_warned()
    {
        $profile = $this->driver->driverProfile;
        $profile->forceFill(['rating_avg' => 3.6, 'rating_count' => 25])->save();
        $good = User::create(['name' => 'Good Driver', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $good->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified', 'rating_avg' => 4.9, 'rating_count' => 40])->save();
        $newbie = User::create(['name' => 'New Driver', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $newbie->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified', 'rating_avg' => 3.0, 'rating_count' => 3])->save();

        Sanctum::actingAs($this->admin);
        $list = $this->getJson('/api/admin/drivers/review')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.user_id', $this->driver->id)->assertJsonPath('0.reasons', ['low_rating']);
        OpenApiContract::assertResponse($list, 'get', '/admin/drivers/review');

        $this->postJson("/api/admin/drivers/{$this->driver->id}/warn", ['message' => 'x'])->assertStatus(422);
        OpenApiContract::assertResponse(
            $this->postJson("/api/admin/drivers/{$this->driver->id}/warn", ['message' => 'Riders report unsafe driving. Please slow down.'])->assertOk(),
            'post', '/admin/drivers/{userId}/warn');
        $this->assertNotNull($this->getJson('/api/admin/drivers/review')->json('0.warned_at'));

        Sanctum::actingAs($this->rider);
        $this->getJson('/api/admin/drivers/review')->assertForbidden();
    }

    /** @test */
    public function drivers_cancelling_too_often_need_review()
    {
        $this->driver->driverProfile->forceFill(['rating_avg' => 4.9, 'rating_count' => 50])->save();
        for ($i = 0; $i < 10; $i++) {
            $this->travel(11)->seconds();   // stay under the 6 requests/min limit
            DriverPresence::whereKey($this->driver->id)->update(['last_seen_at' => now()]);
            $id = $this->acceptedRide();
            Sanctum::actingAs($this->driver);
            if ($i < 2) {
                $this->postJson("/api/rides/$id/cancel", ['reason' => 'traffic'])->assertOk();
            } else {
                Ride::whereKey($id)->update(['status' => 'completed', 'completed_at' => now()]);
            }
        }

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/admin/drivers/review')->assertJsonPath('0.reasons', ['high_cancel_rate'])->assertJsonPath('0.cancel_pct', 20);
    }
}
