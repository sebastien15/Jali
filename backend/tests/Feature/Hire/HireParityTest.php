<?php

namespace Tests\Feature\Hire;

use App\Models\DriverHire;
use App\Models\Role;
use App\Models\User;
use App\Modules\Payments\Contracts\ProviderDebtLimit;
use App\Services\PushService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Architecture migration M03-Hire parity: behaviour that must survive moving
 * hire into App\Modules\DriverHire — locked quotes, Kigali calendar time,
 * expiry, lifecycle guards, privacy and booking rules. Written and run green
 * against the pre-move code first.
 */
class HireParityTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $driver;

    private const RATES = [
        'hourly_rate' => 3000, 'min_hours' => 2, 'daily_rate' => 25000, 'daily_hours' => 10,
        'overtime_per_hour' => 4000, 'out_of_town_fee' => 10000,
        'transmissions' => ['automatic', 'manual'], 'languages' => ['rw', 'en'], 'years_experience' => 8,
    ];

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        // Monday 12 Oct 2026, 08:00 in Kigali
        $this->travelTo(Carbon::parse('2026-10-12 08:00', 'Africa/Kigali')->utc());
        $this->customer = User::create(['name' => 'Grace Uwase', 'phone' => '+250788111111', 'fcm_token' => 'ExponentPushToken[customer]',
            'role_id' => Role::where('name', 'user')->value('id')]);
        $this->driver = $this->hireDriver('Eric Nshimiyimana', '+250788222222', 'ExponentPushToken[driver]');
    }

    private function hireDriver(string $name, string $phone, ?string $token = null, array $rates = []): User
    {
        $driver = User::create(['name' => $name, 'phone' => $phone, 'fcm_token' => $token, 'role_id' => Role::where('name', 'driver')->value('id')]);
        $driver->driverProfile()->create(['services' => ['hire'], 'licence_categories' => ['B']])
            ->forceFill(['verification_status' => 'verified'])->save();
        Sanctum::actingAs($driver);
        $this->putJson('/api/driver/hire-settings', $rates + self::RATES)->assertOk();

        return $driver->fresh();
    }

    private static function at(string $local): string
    {
        return Carbon::parse($local, 'Africa/Kigali')->toIso8601String();
    }

    private function booking(array $overrides = []): array
    {
        return $overrides + [
            'driver_id' => $this->driver->id, 'start_at' => self::at('2026-10-14 09:00'),
            'duration_type' => 'hours', 'duration_value' => 4, 'trip_type' => 'city', 'transmission' => 'automatic',
            'pickup' => ['lat' => -1.9536, 'lng' => 30.0927, 'address' => 'Kigali Convention Centre'],
            'accept_terms' => true,
        ];
    }

    private function book(array $overrides = [], ?User $as = null): array
    {
        Sanctum::actingAs($as ?? $this->customer);

        return $this->postJson('/api/driver-hire', $this->booking($overrides))->assertCreated()->json();
    }

    private function search(string $start, string $type = 'hours', int $value = 4): array
    {
        Sanctum::actingAs($this->customer);

        return $this->getJson('/api/driver-hire/available?' . http_build_query([
            'start_at' => $start, 'duration_type' => $type, 'duration_value' => $value, 'trip_type' => 'city', 'transmission' => 'automatic',
        ]))->assertOk()->json('drivers');
    }

    /** @test */
    public function the_price_rates_fee_and_commission_are_locked_at_booking()
    {
        $hire = $this->book();

        // Everything changes after the booking: the platform fee/commission and the driver's own rates
        $admin = User::create(['name' => 'Root', 'email' => 'root@jali.rw', 'role_id' => Role::where('name', 'superadmin')->value('id')]);
        Sanctum::actingAs($admin);
        $this->putJson('/api/admin/settings/rides', ['hire' => ['service_fee' => 900, 'commission_pct' => 20]])->assertOk();
        Sanctum::actingAs($this->driver);
        $this->putJson('/api/driver/hire-settings', ['hourly_rate' => 5000, 'overtime_per_hour' => 9000] + self::RATES)->assertOk();

        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertOk()
            ->assertJsonPath('driver_total', 12000)->assertJsonPath('service_fee', 500)->assertJsonPath('quoted_total', 12500)
            ->assertJsonPath('driver_earnings', 12000 - 1200);

        // Overtime uses the locked 4000/h, commission the locked 10%
        $this->travelTo(Carbon::parse('2026-10-14 09:00', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-in")->assertOk();
        $this->travelTo(Carbon::parse('2026-10-14 13:30', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-out", ['payment_method' => 'cash'])->assertOk()
            ->assertJsonPath('overtime_minutes', 30)
            ->assertJsonPath('overtime_amount', 2000)
            ->assertJsonPath('final_total', 12500 + 2000)
            ->assertJsonPath('driver_earnings', 14000 - 1400);
        $this->assertSame(1400 + 500, \App\Modules\Payments\Application\DriverLedger::owed($this->driver->id));
        $this->assertSame(1, $this->driver->driverProfile->fresh()->trips_count);

        // New bookings use the new prices
        $this->assertSame(4 * 5000 + 900, collect($this->search(self::at('2026-10-15 09:00')))->firstWhere('driver_id', $this->driver->id)['quote']['total']);
    }

    /** @test */
    public function overtime_within_the_grace_period_is_free_and_late_starts_caused_by_the_customer_shift_the_end()
    {
        $hire = $this->book();
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertOk();

        // Driver could only start at 10:00: booked 4 h count from check-in → expected end 14:00; 14:10 is inside the 15 min grace
        $this->travelTo(Carbon::parse('2026-10-14 10:00', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-in")->assertOk();
        $this->travelTo(Carbon::parse('2026-10-14 14:10', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-out", ['payment_method' => 'cash'])->assertOk()
            ->assertJsonPath('overtime_minutes', 0)->assertJsonPath('overtime_amount', 0)->assertJsonPath('final_total', 12500);
    }

    /** @test */
    public function calendar_rules_use_kigali_time_whatever_offset_the_client_sends()
    {
        Sanctum::actingAs($this->driver);
        $this->putJson('/api/driver/availability', ['weekly' => [['weekday' => 3, 'start_time' => '07:00', 'end_time' => '12:00']], 'blocked_dates' => []])->assertOk();

        // 05:00Z is 07:00 in Kigali: inside Wednesday's hours
        $this->assertCount(1, $this->search('2026-10-14T05:00:00Z'));
        $this->assertCount(1, $this->search('2026-10-14T07:00:00+02:00'));
        // 07:30 Kigali + 5 h ends 12:30: after hours
        $this->assertCount(0, $this->search('2026-10-14T05:30:00Z', 'hours', 5));
        // 23:00Z Tuesday is 01:00 Wednesday in Kigali: before hours
        $this->assertCount(0, $this->search('2026-10-13T23:00:00Z', 'hours', 2));

        // Blocked dates are Kigali dates: 22:30Z Wednesday is already Thursday 00:30 in Kigali
        Sanctum::actingAs($this->driver);
        $this->putJson('/api/driver/availability', ['weekly' => [], 'blocked_dates' => ['2026-10-15']])->assertOk();
        $this->assertCount(0, $this->search('2026-10-14T22:30:00Z', 'hours', 2));
        $this->assertCount(1, $this->search('2026-10-14T19:00:00Z', 'hours', 2));   // Wed 21:00–23:00 Kigali

        // Day bookings end daily_hours after the start on the last day; seconds are dropped
        $days = $this->search(self::at('2026-10-13 09:00'), 'days', 2);
        $this->assertTrue(Carbon::parse($days[0]['end_at'])->equalTo(Carbon::parse('2026-10-14 19:00', 'Africa/Kigali')));
        $hire = $this->book(['start_at' => '2026-10-13T09:00:45+02:00']);
        $this->assertTrue(Carbon::parse($hire['start_at'])->equalTo(Carbon::parse('2026-10-13 09:00:00', 'Africa/Kigali')));
        $this->assertTrue(Carbon::parse($hire['end_at'])->equalTo(Carbon::parse('2026-10-13 13:00:00', 'Africa/Kigali')));
    }

    /** @test */
    public function requests_expire_at_the_start_time_or_the_timeout_and_are_expired_lazily_on_read()
    {
        // Start in 40 min: the request expires at the start, before the 60 min timeout
        $soon = $this->book(['start_at' => self::at('2026-10-12 08:40')]);
        $this->assertTrue(Carbon::parse($soon['expires_at'])->equalTo(Carbon::parse('2026-10-12 08:40', 'Africa/Kigali')));
        $later = $this->book(['start_at' => self::at('2026-10-14 09:00')]);
        $this->assertTrue(Carbon::parse($later['expires_at'])->equalTo(Carbon::parse('2026-10-12 09:00', 'Africa/Kigali')));

        // Customer reading the hire expires it (no scheduler run needed)
        $this->travelTo(Carbon::parse('2026-10-12 08:41', 'Africa/Kigali')->utc());
        Sanctum::actingAs($this->customer);
        $this->getJson("/api/driver-hire/{$soon['id']}")->assertOk()->assertJsonPath('status', 'expired')->assertJsonPath('expires_at', null);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[customer]' && $r['title'] === 'No answer from the driver');
        $this->getJson('/api/driver-hire')->assertOk()->assertJsonPath('data.0.status', 'requested')->assertJsonPath('data.1.status', 'expired');

        // Driver's list expires their overdue requests
        $this->travelTo(Carbon::parse('2026-10-12 09:01', 'Africa/Kigali')->utc());
        Sanctum::actingAs($this->driver);
        $this->getJson('/api/driver/hires?scope=requests')->assertOk()->assertJsonCount(0);
        $this->assertSame('expired', DriverHire::find($later['id'])->status);
        $this->getJson('/api/driver/hires?scope=past')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/driver/hires?scope=everything')->assertStatus(422);
    }

    /** @test */
    public function lifecycle_transitions_are_guarded_with_the_same_errors()
    {
        $hire = $this->book();
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$hire['id']}/check-out", ['payment_method' => 'cash'])->assertStatus(409)
            ->assertJsonPath('message', 'This hire is not in progress.');
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertOk();
        $this->postJson("/api/driver-hire/{$hire['id']}/decline")->assertStatus(409)->assertJsonPath('message', 'This request is no longer open.');
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertStatus(409)->assertJsonPath('message', 'This request is no longer open.');

        $this->getJson('/api/driver/hires?scope=upcoming')->assertOk()->assertJsonPath('0.id', $hire['id']);
        $this->getJson('/api/driver/hires')->assertOk()->assertJsonCount(0);
        $calendar = $this->getJson('/api/driver/availability')->assertOk()->json('upcoming');
        $this->assertSame([$hire['id']], array_column($calendar, 'id'));

        // Check-in closes at the booked end
        $this->travelTo(Carbon::parse('2026-10-14 13:01', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-in")->assertStatus(409)
            ->assertJsonPath('message', 'You can check in from 2 hours before the start time.');

        // Started hires can't be cancelled by either side
        $this->travelTo(Carbon::parse('2026-10-14 12:00', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-in")->assertOk();
        $this->postJson("/api/driver-hire/{$hire['id']}/cancel", ['reason' => 'other'])->assertStatus(409)
            ->assertJsonPath('message', 'This hire can no longer be cancelled.');
        Sanctum::actingAs($this->customer);
        $this->postJson("/api/driver-hire/{$hire['id']}/cancel", ['reason' => 'other'])->assertStatus(409);
        $this->postJson("/api/driver-hire/{$hire['id']}/rate", ['stars' => 5])->assertStatus(409)
            ->assertJsonPath('message', 'You can rate once the hire is completed.');
    }

    /** @test */
    public function each_side_sees_only_what_it_should()
    {
        $hire = $this->book();
        $this->assertSame('customer', $hire['role']);
        $this->assertNull($hire['customer']);
        $this->assertNull($hire['driver_earnings']);
        $this->assertSame('Eric N.', $hire['driver']['name']);
        $this->assertSame(0, $hire['cancel_fee_now']);

        Sanctum::actingAs($this->driver);
        $this->getJson('/api/driver/hires')->assertOk()
            ->assertJsonPath('0.role', 'driver')
            ->assertJsonPath('0.customer.name', 'Grace U.')
            ->assertJsonPath('0.customer.phone', null)
            ->assertJsonPath('0.driver.phone', null)
            ->assertJsonPath('0.cancel_fee_now', null);
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertOk()->assertJsonPath('customer.phone', '+250788111111');
        $this->postJson("/api/driver-hire/{$hire['id']}/cancel", ['reason' => 'not_available'])->assertOk()
            ->assertJsonPath('customer.phone', null)->assertJsonPath('expires_at', null);

        Sanctum::actingAs($this->customer);
        $this->getJson("/api/driver-hire/{$hire['id']}")->assertOk()->assertJsonPath('driver.phone', null)->assertJsonPath('cancel_fee_now', null);
    }

    /** @test */
    public function booking_rules_reject_bad_windows_clashes_and_unbookable_drivers()
    {
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/driver-hire', $this->booking(['start_at' => self::at('2027-01-15 09:00')]))->assertStatus(422)
            ->assertJsonPath('errors.start_at.0', 'You can book up to 90 days ahead.');
        $this->postJson('/api/driver-hire', $this->booking(['duration_type' => 'days', 'duration_value' => 15]))->assertStatus(422)
            ->assertJsonValidationErrors('duration_value');

        // A driver can't hire themself
        Sanctum::actingAs($this->driver);
        $this->postJson('/api/driver-hire', $this->booking())->assertStatus(422)
            ->assertJsonPath('errors.driver_id.0', 'This driver is not available for hire.');

        // Wrong transmission
        $auto = $this->hireDriver('Auto Only', '+250788333333', null, ['transmissions' => ['automatic']]);
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/driver-hire', $this->booking(['driver_id' => $auto->id, 'transmission' => 'manual']))->assertStatus(422)
            ->assertJsonValidationErrors('driver_id');

        // The customer can't hold two overlapping bookings, even with different drivers
        $this->book();
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/driver-hire', $this->booking(['driver_id' => $auto->id, 'start_at' => self::at('2026-10-14 11:00')]))->assertStatus(409)
            ->assertJsonPath('message', 'You already have a driver booked for that time.');
    }

    /** @test */
    public function hire_completion_feeds_the_shared_debt_limit()
    {
        $hire = $this->book(['duration_type' => 'days', 'duration_value' => 1]);
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertOk();
        $this->travelTo(Carbon::parse('2026-10-14 09:00', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-in")->assertOk();
        $this->travelTo(Carbon::parse('2026-10-14 19:00', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-out", ['payment_method' => 'cash'])->assertOk()
            ->assertJsonPath('final_total', 25500)->assertJsonPath('driver_earnings', 25000 - 2500);

        // 2500 commission + 500 fee owed: below the default limit, above a lower one
        $this->assertFalse(app(ProviderDebtLimit::class)->isOverLimit($this->driver->id));
        Sanctum::actingAs(User::create(['name' => 'Root', 'email' => 'root@jali.rw', 'role_id' => Role::where('name', 'superadmin')->value('id')]));
        $this->putJson('/api/admin/settings/rides', ['max_commission_owed' => 2999])->assertOk();
        $this->assertTrue(app(ProviderDebtLimit::class)->isOverLimit($this->driver->id));
    }
}
