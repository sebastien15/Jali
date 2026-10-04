<?php

namespace Tests\Feature;

use App\Services\SmsSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OtpLoginTest extends TestCase
{
    use RefreshDatabase;

    private ?string $sentCode = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        config(['services.otp.dev_code' => null]);

        // Capture the code instead of sending an SMS.
        $this->app->instance(SmsSender::class, new class($this) extends SmsSender {
            public function __construct(private OtpLoginTest $test) {}
            public function send(string $phone, string $message): void
            {
                preg_match('/\d{6}/', $message, $m);
                $this->test->captureCode($m[0]);
            }
        });
    }

    public function captureCode(string $code): void
    {
        $this->sentCode = $code;
    }

    public function test_fixed_123456_is_not_accepted(): void
    {
        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456'])->assertOk();

        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => '123456'])
            ->assertStatus(401);
    }

    public function test_correct_code_logs_in_and_normalises_phone(): void
    {
        $this->postJson('/api/auth/otp/request', ['phone' => '0788 123 456'])->assertOk();

        $this->postJson('/api/auth/otp/verify', ['phone' => '+250788123456', 'otp' => $this->sentCode])
            ->assertOk()
            ->assertJsonStructure(['token'])
            ->assertJsonPath('user.phone', '+250788123456')
            ->assertJsonPath('user.roles', 'user');
    }

    public function test_code_is_single_use(): void
    {
        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456']);
        $code = $this->sentCode;

        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => $code])->assertOk();
        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => $code])->assertStatus(401);
    }

    public function test_code_is_burned_after_too_many_wrong_attempts(): void
    {
        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => '000000']);
        }

        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => $this->sentCode])
            ->assertStatus(401);
    }

    public function test_invalid_phone_is_rejected(): void
    {
        $this->postJson('/api/auth/otp/request', ['phone' => '12345'])->assertStatus(422);
    }

    public function test_dev_code_is_ignored_in_production(): void
    {
        config(['services.otp.dev_code' => '123456']);
        $this->app['env'] = 'production';

        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => '123456'])
            ->assertStatus(401);
    }

    public function test_login_is_rate_limited(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'x@jali.rw', 'password' => 'bad']);
        }

        $this->postJson('/api/auth/login', ['email' => 'x@jali.rw', 'password' => 'bad'])
            ->assertStatus(429);
    }
}
