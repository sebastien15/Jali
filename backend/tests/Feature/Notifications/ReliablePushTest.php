<?php

namespace Tests\Feature\Notifications;

use App\Models\PushNotification;
use App\Models\Role;
use App\Models\User;
use App\Modules\Notifications\Contracts\PushSender;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** S12.3: loud ride-request channel, delivery/open tracking, SMS fallback for critical rider events. */
class ReliablePushTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function person(string $role, ?string $token, string $phone): User
    {
        return User::create(['name' => $role, 'phone' => $phone, 'fcm_token' => $token, 'role_id' => Role::where('name', $role)->value('id')]);
    }

    public function test_ride_requests_ring_on_the_dedicated_channel_and_every_push_is_logged(): void
    {
        $driver = $this->person('driver', 'ExponentPushToken[driver]', '+250788200001');
        $push = app(PushSender::class);

        $push->send($driver, 'New ride request', 'Kiyovu → Kimironko', ['screen' => 'driver_ride', 'id' => 5]);
        $push->send($driver, 'Payout sent', 'x', ['screen' => 'driver_earnings']);

        Http::assertSent(fn ($r) => $r['title'] === 'New ride request' && $r['channelId'] === 'ride_requests'
            && $r['sound'] === 'ride_request.wav' && $r['priority'] === 'high');
        Http::assertSent(fn ($r) => $r['title'] === 'Payout sent' && $r['channelId'] === 'default' && $r['sound'] === 'default');
        $this->assertSame(['driver_ride' => 'ride_requests', 'driver_earnings' => 'default'],
            PushNotification::orderBy('id')->pluck('channel', 'type')->all());
        $this->assertSame(['sent', 'sent'], PushNotification::pluck('status')->all());

        $noToken = $this->person('user', null, '+250788200002');
        $this->assertFalse($push->send($noToken, 'Hi', 'x', ['screen' => 'ride']));
        $this->assertSame('no_token', PushNotification::latest('id')->value('status'));
    }

    public function test_opens_are_tracked_per_user_and_rates_reported_per_type(): void
    {
        $rider = $this->person('user', 'ExponentPushToken[rider]', '+250788200003');
        $push = app(PushSender::class);
        $push->send($rider, 'Driver accepted', 'x', ['screen' => 'ride', 'id' => 1]);
        $push->send($rider, 'Driver arrived', 'x', ['screen' => 'ride', 'id' => 1]);
        $first = PushNotification::orderBy('id')->value('id');

        Sanctum::actingAs($this->person('user', null, '+250788200004'));
        $this->postJson("/api/me/notifications/$first/opened")->assertNotFound();   // not theirs

        Sanctum::actingAs($rider);
        $this->postJson("/api/me/notifications/$first/opened")->assertNoContent();
        $this->postJson("/api/me/notifications/$first/opened")->assertNoContent();   // idempotent

        Sanctum::actingAs($this->person('superadmin', null, '+250788200005'));
        $stats = $this->getJson('/api/admin/notifications/stats?days=7')->assertOk()
            ->assertJsonPath('types.0.type', 'ride')->assertJsonPath('types.0.delivered', 2)
            ->assertJsonPath('types.0.opened', 1)->assertJsonPath('types.0.open_rate', 0.5);
        OpenApiContract::assertResponse($stats, 'get', '/admin/notifications/stats');

        Sanctum::actingAs($rider);
        $this->getJson('/api/admin/notifications/stats')->assertStatus(403);
    }

    public function test_driver_arrived_falls_back_to_sms_when_not_opened_in_time(): void
    {
        config(['services.push.sms_fallback_seconds' => 60]);
        Log::spy();
        $rider = $this->person('user', 'ExponentPushToken[rider]', '+250788200006');
        $other = $this->person('user', 'ExponentPushToken[other]', '+250788200007');
        $push = app(PushSender::class);
        $push->send($rider, 'Your driver has arrived', 'PIN 1234', ['screen' => 'ride', 'id' => 9], ['sms_fallback' => 'Jali: your driver has arrived. PIN 1234.']);
        $push->send($other, 'Your driver has arrived', 'PIN 5678', ['screen' => 'ride', 'id' => 10], ['sms_fallback' => 'Jali: your driver has arrived. PIN 5678.']);

        // Nothing is due before 60 s
        Artisan::call('notifications:sms-fallback');
        $this->assertSame(0, PushNotification::whereNotNull('sms_sent_at')->count());

        // The other rider opened theirs in time
        Sanctum::actingAs($other);
        $this->postJson('/api/me/notifications/' . PushNotification::where('user_id', $other->id)->value('id') . '/opened')->assertNoContent();

        $this->travel(61)->seconds();
        Artisan::call('notifications:sms-fallback');
        Artisan::call('notifications:sms-fallback');   // never twice
        Log::shouldHaveReceived('info')->with('[SMS] +250788200006: Jali: your driver has arrived. PIN 1234.')->once();
        Log::shouldNotHaveReceived('info', ['[SMS] +250788200007: Jali: your driver has arrived. PIN 5678.']);
        $this->assertSame(1, PushNotification::whereNotNull('sms_sent_at')->count());
    }
}
