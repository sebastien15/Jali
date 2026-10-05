<?php

namespace Tests\Feature;

use App\Models\AdminStation;
use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PushNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_push_token_is_validated_and_saved(): void
    {
        $user = $this->actingAsRole('user');

        $this->postJson('/api/me/push-token', ['token' => 'not-a-token'])->assertStatus(422);
        $this->postJson('/api/me/push-token', ['token' => 'ExponentPushToken[abc123_-X]'])->assertOk();

        $this->assertSame('ExponentPushToken[abc123_-X]', $user->fresh()->fcm_token);
    }

    public function test_passenger_is_notified_when_booking_is_claimed(): void
    {
        Http::fake(['exp.host/*' => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed();
        $booking = Booking::where('type', 'trip')->where('status', 'pending')->with('departure.route', 'user')->firstOrFail();
        $booking->user->forceFill(['fcm_token' => 'ExponentPushToken[device1]'])->save();

        $agent = $this->makeUser('admin');
        AdminStation::whereKey($booking->departure->route->from_station_id)->update(['user_id' => $agent->id]);
        Sanctum::actingAs($agent);

        $this->patchJson("/api/admin/bookings/{$booking->id}", ['status' => 'taken'])->assertOk();
        $this->app->terminate(); // run afterResponse jobs

        Http::assertSent(fn ($req) => str_contains($req->url(), 'exp.host')
            && $req['to'] === 'ExponentPushToken[device1]'
            && $req['data']['booking_id'] === $booking->id);
    }
}
