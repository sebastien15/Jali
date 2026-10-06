<?php

namespace Tests\Feature\Notifications;

use App\Models\User;
use App\Modules\Notifications\Contracts\PushSender;
use App\Modules\Notifications\Contracts\PushTokens;
use App\Services\PushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Mockery;
use Tests\TestCase;

/** M03-Remaining: the Notifications push port delegates to the lazily bound PushService. */
class PushSenderTest extends TestCase
{
    use RefreshDatabase;

    public function test_push_sender_delivers_through_push_service_with_the_same_payload(): void
    {
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $user = $this->makeUser('user', ['fcm_token' => 'ExponentPushToken[abc]']);

        $this->assertTrue(app(PushSender::class)->send($user, 'Title', 'Body', ['screen' => 'ride', 'id' => 7]));

        Http::assertSent(fn ($request) => $request->url() === PushService::EXPO_ENDPOINT
            && $request['to'] === 'ExponentPushToken[abc]' && $request['title'] === 'Title'
            && (array) $request->data()['data'] === ['screen' => 'ride', 'id' => '7']);
    }

    public function test_push_sender_never_throws_and_honours_a_replaced_push_service(): void
    {
        config(['firebase.projects.app.credentials' => '/nonexistent/credentials.json']);
        $user = $this->makeUser('user', ['fcm_token' => 'raw-fcm-token']);
        $this->assertFalse(app(PushSender::class)->send($user, 'a', 'b'));   // lazy Firebase client fails inside PushService

        $fake = Mockery::mock(PushService::class);
        $fake->shouldReceive('send')->once()->with($user, 'a', 'b', ['screen' => 'x'])->andReturn(true);
        $this->app->instance(PushService::class, $fake);

        $this->assertTrue(app(PushSender::class)->send($user, 'a', 'b', ['screen' => 'x']));
    }

    public function test_push_tokens_register_and_forget(): void
    {
        $user = $this->makeUser('user');

        app(PushTokens::class)->register($user, 'ExponentPushToken[new]');
        $this->assertSame('ExponentPushToken[new]', $user->fresh()->fcm_token);

        app(PushTokens::class)->forget($user);
        $this->assertNull(User::find($user->id)->fcm_token);
    }
}
