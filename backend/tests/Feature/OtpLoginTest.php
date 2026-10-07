<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Notifications\Infrastructure\SmsService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Phone sign-in: real one-time codes; the fixed dev code never works in production. */
class OtpLoginTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        config([
            'app.stage' => 'prod',
            'services.otp.dev_code' => null,
            'services.sms.driver' => 'africastalking',
            'services.sms.africastalking' => ['username' => 'jali', 'api_key' => 'secret', 'sender_id' => 'JALI'],
        ]);
    }

    private function fakeSms(): void
    {
        Http::fake([SmsService::AFRICASTALKING_ENDPOINT => Http::response(['SMSMessageData' => ['Recipients' => [['status' => 'Success']]]])]);
    }

    /** The code that was texted to the phone */
    private function sentCode(): string
    {
        $code = null;
        Http::assertSent(function ($request) use (&$code) {
            preg_match('/code is (\d{6})/', $request['message'], $m);
            $code = $m[1] ?? $code;

            return $request->hasHeader('apiKey', 'secret') && $request['to'] === '+250788123456' && $request['from'] === 'JALI';
        });

        return $code;
    }

    /** @test */
    public function the_old_fixed_code_does_not_sign_anyone_in_in_production()
    {
        $this->app['env'] = 'production';
        config(['services.otp.dev_code' => '123456']);   // even if someone sets it by mistake
        $this->fakeSms();
        $victim = User::create(['name' => 'Victim', 'phone' => '+250788123456']);

        $this->postJson('/api/auth/otp/verify', ['phone' => '+250788123456', 'otp' => '123456'])->assertStatus(401);
        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456'])->assertOk();
        $this->postJson('/api/auth/otp/verify', ['phone' => '+250788123456', 'otp' => '123456'])->assertStatus(401);
        $this->assertSame(0, $victim->tokens()->count());
    }

    /** @test */
    public function a_texted_code_signs_in_once_and_finds_the_existing_account()
    {
        $this->fakeSms();
        $existing = User::create(['name' => 'Aline', 'phone' => '0788123456']);

        $this->postJson('/api/auth/otp/request', ['phone' => '+250 788 123 456'])->assertOk();
        $code = $this->sentCode();
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);

        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => $code])->assertOk()
            ->assertJsonPath('user.id', $existing->id)->assertJsonStructure(['token']);
        // A code works only once
        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => $code])->assertStatus(401);
    }

    /** @test */
    public function new_numbers_get_an_account_with_the_normalised_phone()
    {
        $this->fakeSms();
        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456'])->assertOk();
        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => $this->sentCode()])->assertOk()
            ->assertJsonPath('user.phone', '+250788123456');
    }

    /** @test */
    public function five_wrong_codes_burn_the_code_and_codes_expire()
    {
        $this->fakeSms();
        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456'])->assertOk();
        $code = $this->sentCode();
        $wrong = $code === '000000' ? '111111' : '000000';
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => $wrong])->assertStatus(401);
        }
        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => $code])->assertStatus(401);

        Http::fake([SmsService::AFRICASTALKING_ENDPOINT => Http::response(['SMSMessageData' => ['Recipients' => [['status' => 'Success']]]])]);
        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456'])->assertOk();
        $fresh = $this->sentCode();
        $this->travel(11)->minutes();
        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => $fresh])->assertStatus(401);
    }

    /** @test */
    public function production_without_an_sms_provider_refuses_instead_of_pretending()
    {
        $this->app['env'] = 'production';
        config(['services.sms.driver' => 'log']);
        Http::fake();

        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456'])->assertStatus(503);
        Http::assertNothingSent();
    }

    /** @test */
    public function a_failed_sms_is_reported_and_invalid_numbers_rejected()
    {
        Http::fake([SmsService::AFRICASTALKING_ENDPOINT => Http::response(['SMSMessageData' => ['Recipients' => [['status' => 'InvalidPhoneNumber']]]])]);
        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456'])->assertStatus(503);
        $this->postJson('/api/auth/otp/request', ['phone' => '12'])->assertStatus(422);
    }

    /** @test */
    public function the_dev_code_works_only_locally_when_configured()
    {
        config(['services.otp.dev_code' => '123456', 'services.sms.driver' => 'log']);
        Http::fake();

        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456'])->assertOk();
        $this->postJson('/api/auth/otp/verify', ['phone' => '0788123456', 'otp' => '123456'])->assertOk();
        Http::assertNothingSent();

        $this->app['env'] = 'staging';
        $this->postJson('/api/auth/otp/request', ['phone' => '0788123456'])->assertStatus(503);   // log driver refused outside local
    }

    /** @test */
    public function the_dev_stage_signs_in_and_registers_with_the_fixed_code_without_sms()
    {
        $this->app['env'] = 'production';
        config(['app.stage' => 'dev', 'services.sms.driver' => 'log']);
        Http::fake();

        $this->getJson('/api/auth/demo-accounts')->assertOk()->assertJsonPath('otp_code', '123456');
        $this->postJson('/api/auth/otp/request', ['phone' => '0788999111'])->assertOk();
        $this->postJson('/api/auth/otp/verify', ['phone' => '0788999111', 'otp' => '123456'])->assertOk()->assertJsonStructure(['token']);
        $this->assertDatabaseHas('users', ['phone' => '+250788999111']);
        Http::assertNothingSent();

        config(['app.stage' => 'test']);
        $this->getJson('/api/auth/demo-accounts')->assertOk()->assertJsonPath('otp_code', null);
        $this->postJson('/api/auth/otp/request', ['phone' => '0788999111'])->assertStatus(503);
    }
}
