<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Kreait\Firebase\Contract\Messaging;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class PushServiceTest extends TestCase
{
    use RefreshDatabase;

    private function user(?string $token, string $role = 'user'): User
    {
        if (!Role::where('name', $role)->exists()) {
            $this->seed(RolesAndPermissionsSeeder::class);
        }

        return User::create([
            'name'      => 'Test',
            'fcm_token' => $token,
            'role_id'   => Role::where('name', $role)->value('id'),
        ]);
    }

    /** @test */
    public function missing_token_is_a_silent_no_op()
    {
        Http::fake();

        $sent = (new PushService())->send($this->user(null), 'Hi', 'There');

        $this->assertFalse($sent);
        Http::assertNothingSent();
    }

    /** @test */
    public function expo_tokens_go_through_the_expo_push_api_with_string_data()
    {
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);

        $sent = (new PushService())->send(
            $this->user('ExponentPushToken[abc123]'),
            'Driver accepted',
            'Jean is on the way',
            ['screen' => 'ride', 'id' => 123],
        );

        $this->assertTrue($sent);
        Http::assertSent(fn ($request) =>
            $request->url() === PushService::EXPO_ENDPOINT
            && $request['to'] === 'ExponentPushToken[abc123]'
            && $request['title'] === 'Driver accepted'
            && ((array) $request->data()['data'])['screen'] === 'ride'
            && ((array) $request->data()['data'])['id'] === '123');
    }

    /** @test */
    public function expo_error_ticket_returns_false()
    {
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'error', 'message' => 'DeviceNotRegistered']])]);

        $this->assertFalse((new PushService())->send($this->user('ExponentPushToken[x]'), 'a', 'b'));
    }

    /** @test */
    public function fcm_tokens_go_through_firebase_messaging()
    {
        $messaging = Mockery::mock(Messaging::class);
        $messaging->shouldReceive('send')->once()->withArgs(fn ($message) =>
            $message['token'] === 'fcm-device-token'
            && $message['notification']['title'] === 'Your ticket is ready'
            && $message['data'] === ['screen' => 'booking', 'id' => '7']);

        $sent = (new PushService($messaging))->send(
            $this->user('fcm-device-token'),
            'Your ticket is ready',
            'Tap to view',
            ['screen' => 'booking', 'id' => 7],
        );

        $this->assertTrue($sent);
    }

    /** @test */
    public function messaging_failures_never_throw()
    {
        $messaging = Mockery::mock(Messaging::class);
        $messaging->shouldReceive('send')->andThrow(new \RuntimeException('FCM down'));

        $this->assertFalse((new PushService($messaging))->send($this->user('fcm-token'), 'a', 'b'));
    }

    /** @test */
    public function missing_firebase_credentials_do_not_break_the_caller()
    {
        config(['firebase.projects.app.credentials' => '/nonexistent/credentials.json']);

        $this->assertFalse(app(PushService::class)->send($this->user('raw-fcm-token'), 'a', 'b'));
    }

    /** @test */
    public function users_can_register_and_remove_their_push_token()
    {
        $this->postJson('/api/me/push-token', ['token' => 'x'])->assertStatus(401);

        $user = $this->user(null);
        Sanctum::actingAs($user);

        $this->postJson('/api/me/push-token', [])->assertStatus(422);
        $this->postJson('/api/me/push-token', ['token' => 'ExponentPushToken[abc]'])->assertOk();
        $this->assertSame('ExponentPushToken[abc]', $user->fresh()->fcm_token);

        $this->deleteJson('/api/me/push-token')->assertOk();
        $this->assertNull($user->fresh()->fcm_token);
    }

    /** @test */
    public function uploading_a_ticket_notifies_the_passenger()
    {
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);

        $passenger = $this->user('ExponentPushToken[passenger]');
        $booking = Booking::create([
            'user_id'      => $passenger->id,
            'type'         => 'bus',
            'reference_id' => 1,
            'title'        => 'Kigali → Musanze',
            'sub'          => 'Departs 08:00',
            'price'        => 3000,
            'service_fee'  => 500,
            'payment_method' => 'MTN MoMo',
            'status'  => 'taken',
        ]);

        Sanctum::actingAs($this->user(null, 'superadmin'));

        $this->patchJson("/api/bookings/{$booking->id}/ticket", ['ticket_photo_url' => 'https://example.com/t.jpg'])
            ->assertOk();

        Http::assertSent(fn ($request) =>
            $request['to'] === 'ExponentPushToken[passenger]'
            && ((array) $request->data()['data'])['screen'] === 'booking'
            && ((array) $request->data()['data'])['id'] === (string) $booking->id);
    }
}
