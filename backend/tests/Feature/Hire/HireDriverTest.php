<?php

namespace Tests\Feature\Hire;

use App\Models\DriverHire;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\Support\WithConfiguredFees;
use Tests\TestCase;

/** Epic E6 — Hire a Driver: stories S6.1, S6.2, S6.3, S6.4 */
class HireDriverTest extends TestCase
{
    use RefreshDatabase, WithConfiguredFees;

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
        $this->configureFees();
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

    /** Kigali local time → ISO string */
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
            'car_description' => 'White Toyota Prado, RAD 123 B', 'notes' => 'Wedding in Nyarutarama', 'accept_terms' => true,
        ];
    }

    private function book(array $overrides = []): array
    {
        Sanctum::actingAs($this->customer);
        $response = $this->postJson('/api/driver-hire', $this->booking($overrides))->assertCreated();
        OpenApiContract::assertResponse($response, 'post', '/driver-hire');

        return $response->json();
    }

    // ── S6.1 rates and skills ────────────────────────────────────────────

    /** @test */
    public function driver_sets_hire_rates_and_skills_within_the_limits()
    {
        Sanctum::actingAs($this->driver);
        $show = $this->getJson('/api/driver/hire-settings')->assertOk()
            ->assertJsonPath('settings.hourly_rate', 3000)
            ->assertJsonPath('skills.languages', ['rw', 'en'])
            ->assertJsonPath('skills.years_experience', 8)
            ->assertJsonPath('skills.licence_categories', ['B'])
            ->assertJsonPath('limits.hourly_max', 15000);
        OpenApiContract::assertResponse($show, 'get', '/driver/hire-settings');

        $bad = $this->putJson('/api/driver/hire-settings', ['hourly_rate' => 99000, 'transmissions' => ['flying']] + self::RATES)
            ->assertStatus(422)->assertJsonValidationErrors(['hourly_rate', 'transmissions.0']);
        $this->assertStringContainsString('15,000 RWF', $bad->json('errors.hourly_rate.0'));
        OpenApiContract::assertResponse($bad, 'put', '/driver/hire-settings');

        $ok = $this->putJson('/api/driver/hire-settings', ['hourly_rate' => 3500, 'languages' => ['fr']] + self::RATES)->assertOk()
            ->assertJsonPath('settings.hourly_rate', 3500)->assertJsonPath('skills.languages', ['fr']);
        OpenApiContract::assertResponse($ok, 'put', '/driver/hire-settings');
    }

    /** @test */
    public function superadmin_hire_limits_apply_to_driver_prices()
    {
        $admin = User::create(['name' => 'Root', 'email' => 'root@jali.rw', 'role_id' => Role::where('name', 'superadmin')->value('id')]);
        Sanctum::actingAs($admin);
        $this->putJson('/api/admin/settings/rides', ['hire' => ['hourly_max' => 2500, 'commission_pct' => 5]])->assertOk()
            ->assertJsonPath('hire.hourly_max', 2500)->assertJsonPath('hire.daily_max', 150000);
        $this->putJson('/api/admin/settings/rides', ['hire' => ['late_cancel_pct' => 300]])->assertStatus(422);

        Sanctum::actingAs($this->driver);
        $this->putJson('/api/driver/hire-settings', self::RATES)->assertStatus(422)->assertJsonValidationErrors('hourly_rate');
        $this->putJson('/api/driver/hire-settings', ['hourly_rate' => 2500] + self::RATES)->assertOk()->assertJsonPath('limits.commission_pct', 5);
    }

    /** @test */
    public function only_verified_drivers_with_hire_permission_can_set_up_hire()
    {
        Sanctum::actingAs($this->customer);
        $this->getJson('/api/driver/hire-settings')->assertForbidden();

        $pending = User::create(['name' => 'New Driver', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $pending->driverProfile()->create(['services' => ['hire']]);
        Sanctum::actingAs($pending);
        $this->getJson('/api/driver/hire-settings')->assertForbidden();
        $this->putJson('/api/driver/hire-settings', self::RATES)->assertForbidden();
    }

    // ── S6.2 availability ────────────────────────────────────────────────

    /** @test */
    public function driver_sets_weekly_hours_and_blocked_dates()
    {
        Sanctum::actingAs($this->driver);
        $this->putJson('/api/driver/availability', ['weekly' => [['weekday' => 1, 'start_time' => '18:00', 'end_time' => '08:00']], 'blocked_dates' => []])
            ->assertStatus(422)->assertJsonValidationErrors('weekly.0.end_time');

        $saved = $this->putJson('/api/driver/availability', [
            'weekly' => [
                ['weekday' => 3, 'start_time' => '07:00', 'end_time' => '20:00'],
                ['weekday' => 1, 'start_time' => '07:00', 'end_time' => '20:00'],
            ],
            'blocked_dates' => ['2026-10-16'],
        ])->assertOk()->assertJsonPath('weekly.0.weekday', 1)->assertJsonPath('blocked_dates', ['2026-10-16']);
        OpenApiContract::assertResponse($saved, 'put', '/driver/availability');
        OpenApiContract::assertResponse($this->getJson('/api/driver/availability')->assertOk(), 'get', '/driver/availability');

        Sanctum::actingAs($this->customer);
        $search = fn (string $start, string $type = 'hours', int $value = 4) => $this->getJson('/api/driver-hire/available?' . http_build_query([
            'start_at' => self::at($start), 'duration_type' => $type, 'duration_value' => $value, 'trip_type' => 'city', 'transmission' => 'automatic',
        ]))->assertOk()->json('drivers');

        $this->assertCount(1, $search('2026-10-14 09:00'));            // Wednesday inside hours
        $this->assertCount(0, $search('2026-10-14 18:00'));            // ends after 20:00
        $this->assertCount(0, $search('2026-10-13 09:00'));            // Tuesday: not a working day
        $this->assertCount(0, $search('2026-10-14 09:00', 'days', 3)); // Wed–Fri includes Thursday + blocked Friday
    }

    // ── S6.3 find and book ───────────────────────────────────────────────

    /** @test */
    public function customer_finds_free_drivers_for_their_transmission_with_a_full_quote()
    {
        $this->hireDriver('Auto Only', '+250788333333', null, ['transmissions' => ['automatic'], 'hourly_rate' => 2000]);
        $inactive = $this->hireDriver('On Leave', '+250788444444');
        $inactive->hireSettings->update(['is_active' => false]);

        Sanctum::actingAs($this->customer);
        $query = ['start_at' => self::at('2026-10-14 09:00'), 'duration_type' => 'hours', 'duration_value' => 1, 'trip_type' => 'out_of_town', 'transmission' => 'manual'];
        $res = $this->getJson('/api/driver-hire/available?' . http_build_query($query))->assertOk();
        OpenApiContract::assertResponse($res, 'get', '/driver-hire/available');
        $res->assertJsonCount(1, 'drivers')
            ->assertJsonPath('drivers.0.name', 'Eric N.')
            ->assertJsonPath('drivers.0.languages', ['rw', 'en'])
            // 1 h asked, 2 h minimum: 2 × 3000 + out-of-town 10000 = 16000, + 500 Jali fee
            ->assertJsonPath('drivers.0.quote.billable_hours', 2)
            ->assertJsonPath('drivers.0.quote.driver_total', 16000)
            ->assertJsonPath('drivers.0.quote.total', 16500);

        $days = $this->getJson('/api/driver-hire/available?' . http_build_query(['duration_type' => 'days', 'duration_value' => 2, 'trip_type' => 'city', 'transmission' => 'automatic'] + $query))
            ->assertJsonCount(2, 'drivers')->json('drivers');
        $this->assertSame(50000, collect($days)->firstWhere('driver_id', $this->driver->id)['quote']['driver_total']);

        $this->getJson('/api/driver-hire/available?' . http_build_query(['start_at' => now()->addMinutes(5)->toIso8601String()] + $query))
            ->assertStatus(422)->assertJsonValidationErrors('start_at');
    }

    /** @test */
    public function hire_is_refused_outside_service_areas_or_where_it_is_switched_off()
    {
        Sanctum::actingAs($this->customer);
        $musanze = ['lat' => -1.4993, 'lng' => 29.6345, 'address' => 'Musanze'];
        $this->postJson('/api/driver-hire', $this->booking(['pickup' => $musanze]))
            ->assertStatus(422)->assertJsonPath('message', 'Not available here yet. Jali currently works in Kigali.');

        \App\Models\ServiceArea::where('name', 'Kigali')->update(['overrides' => json_encode(['services' => ['hire' => false]])]);
        \App\Modules\Locations\Application\ServiceAreaDirectory::forget();
        $this->postJson('/api/driver-hire', $this->booking())
            ->assertStatus(422)->assertJsonPath('message', 'Hire a driver is not available in Kigali yet.');
        $this->assertSame(0, DriverHire::count());
    }

    /** @test */
    public function booking_locks_the_price_requires_terms_and_notifies_the_driver()
    {
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/driver-hire', $this->booking(['accept_terms' => false]))->assertStatus(422)->assertJsonValidationErrors('accept_terms');
        $this->postJson('/api/driver-hire', $this->booking(['transmission' => 'manual', 'driver_id' => 999]))->assertStatus(422)->assertJsonValidationErrors('driver_id');

        $hire = $this->book(['quoted_total' => 1, 'driver_total' => 1]);
        $this->assertSame('requested', $hire['status']);
        $this->assertSame(12000, $hire['driver_total']);            // 4 h × 3000 — client price ignored
        $this->assertSame(12500, $hire['quoted_total']);
        $this->assertNull($hire['driver']['phone']);                 // not before the driver accepts
        $this->assertSame(Carbon::parse('2026-10-14 13:00', 'Africa/Kigali')->toIso8601String(), Carbon::parse($hire['end_at'])->setTimezone('Africa/Kigali')->toIso8601String());
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[driver]' && $r['title'] === 'New hire request');

        $this->postJson('/api/driver-hire', $this->booking())->assertStatus(409);   // same time twice

        $list = $this->getJson('/api/driver-hire')->assertOk()->assertJsonPath('data.0.id', $hire['id']);
        OpenApiContract::assertResponse($list, 'get', '/driver-hire');
    }

    // ── S6.4 lifecycle ───────────────────────────────────────────────────

    /** @test */
    public function full_hire_from_request_to_ratings_with_overtime()
    {
        $hire = $this->book();

        Sanctum::actingAs($this->driver);
        $requests = $this->getJson('/api/driver/hires?scope=requests')->assertOk()->assertJsonPath('0.id', $hire['id'])
            ->assertJsonPath('0.customer.phone', null)
            ->assertJsonPath('0.driver_earnings', 12000 - 1200);    // 10% commission
        OpenApiContract::assertResponse($requests, 'get', '/driver/hires');

        $accepted = $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertOk()
            ->assertJsonPath('status', 'accepted')->assertJsonPath('customer.phone', '+250788111111');
        OpenApiContract::assertResponse($accepted, 'post', '/driver-hire/{id}/accept');
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[customer]' && $r['title'] === 'Your driver is confirmed');

        // Too early to check in
        $early = $this->postJson("/api/driver-hire/{$hire['id']}/check-in")->assertStatus(409);
        OpenApiContract::assertResponse($early, 'post', '/driver-hire/{id}/check-in');

        // Customer now sees the driver's phone
        Sanctum::actingAs($this->customer);
        $this->getJson("/api/driver-hire/{$hire['id']}")->assertJsonPath('driver.phone', '+250788222222');

        // Wednesday 08:50 check-in, 13:40 check-out → 40 min overtime (15 min grace) → 40/60 × 4000 = 2667 → 2700
        $this->travelTo(Carbon::parse('2026-10-14 08:50', 'Africa/Kigali')->utc());
        Sanctum::actingAs($this->driver);
        OpenApiContract::assertResponse($this->postJson("/api/driver-hire/{$hire['id']}/check-in")->assertOk()->assertJsonPath('status', 'started'),
            'post', '/driver-hire/{id}/check-in');
        $this->travelTo(Carbon::parse('2026-10-14 13:40', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire['id']}/check-out")->assertStatus(422);   // payment method required
        $done = $this->postJson("/api/driver-hire/{$hire['id']}/check-out", ['payment_method' => 'momo'])->assertOk()
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('overtime_minutes', 40)
            ->assertJsonPath('overtime_amount', 2700)
            ->assertJsonPath('final_total', 12500 + 2700)
            ->assertJsonPath('driver_earnings', 14700 - 1470);
        OpenApiContract::assertResponse($done, 'post', '/driver-hire/{id}/check-out');
        // S7.2: the driver now owes Jali the commission (10% of 14700) + the 500 fee
        $this->assertSame(1470 + 500, \App\Modules\Payments\Application\DriverLedger::owed($this->driver->id));

        // Ratings both ways; driver rating combines rides and hires
        $this->postJson("/api/driver-hire/{$hire['id']}/rate", ['stars' => 5])->assertCreated();
        Sanctum::actingAs($this->customer);
        OpenApiContract::assertResponse($this->postJson("/api/driver-hire/{$hire['id']}/rate", ['stars' => 4, 'tags' => ['Careful driver']])->assertCreated(),
            'post', '/driver-hire/{id}/rate');
        $this->postJson("/api/driver-hire/{$hire['id']}/rate", ['stars' => 1])->assertStatus(409);
        $this->assertSame(4.0, $this->driver->driverProfile->fresh()->rating_avg);
        $this->getJson("/api/driver-hire/{$hire['id']}")->assertJsonPath('my_rating', 4)->assertJsonPath('driver.phone', null);
    }

    /** @test */
    public function overlapping_accepted_hires_are_rejected()
    {
        $first = $this->book();
        $other = User::create(['name' => 'Other Customer', 'role_id' => Role::where('name', 'user')->value('id')]);
        Sanctum::actingAs($other);
        $second = $this->postJson('/api/driver-hire', $this->booking(['start_at' => self::at('2026-10-14 11:00')]))->assertCreated()->json();

        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$first['id']}/accept")->assertOk();
        $this->postJson("/api/driver-hire/{$second['id']}/accept")->assertStatus(409);

        // Accepted time is no longer offered to customers
        Sanctum::actingAs($this->customer);
        $this->getJson('/api/driver-hire/available?' . http_build_query([
            'start_at' => self::at('2026-10-14 12:00'), 'duration_type' => 'hours', 'duration_value' => 2, 'trip_type' => 'city', 'transmission' => 'automatic',
        ]))->assertJsonCount(0, 'drivers');
    }

    /** @test */
    public function customer_cancels_free_early_and_pays_a_fee_late_and_driver_can_cancel()
    {
        $hire = $this->book();
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertOk();

        Sanctum::actingAs($this->customer);
        $this->getJson("/api/driver-hire/{$hire['id']}")->assertJsonPath('cancel_fee_now', 0);
        // 2 hours before the start: late → 20% of 12000
        $this->travelTo(Carbon::parse('2026-10-14 07:00', 'Africa/Kigali')->utc());
        $this->getJson("/api/driver-hire/{$hire['id']}")->assertJsonPath('cancel_fee_now', 2400);
        $this->postJson("/api/driver-hire/{$hire['id']}/cancel", ['reason' => 'not_available'])->assertStatus(422);   // driver reason
        $cancelled = $this->postJson("/api/driver-hire/{$hire['id']}/cancel", ['reason' => 'changed_plans'])->assertOk()
            ->assertJsonPath('status', 'cancelled_by_customer')->assertJsonPath('cancel_fee', 2400);
        OpenApiContract::assertResponse($cancelled, 'post', '/driver-hire/{id}/cancel');

        $this->travelTo(Carbon::parse('2026-10-12 08:00', 'Africa/Kigali')->utc());
        $again = $this->book(['start_at' => self::at('2026-10-15 09:00')]);
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$again['id']}/cancel", ['reason' => 'not_available'])->assertStatus(409);   // still requested: decline instead
        $this->postJson("/api/driver-hire/{$again['id']}/accept")->assertOk();
        $this->postJson("/api/driver-hire/{$again['id']}/cancel", ['reason' => 'not_available'])->assertOk()
            ->assertJsonPath('status', 'cancelled_by_driver')->assertJsonPath('cancel_fee', 0);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[customer]' && $r['title'] === 'Your driver cancelled');
    }

    /** @test */
    public function unanswered_requests_expire_and_declines_tell_the_customer()
    {
        $hire = $this->book();
        $this->travel(61)->minutes();
        Artisan::call('hires:expire-requests');
        $this->assertSame('expired', DriverHire::find($hire['id'])->status);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[customer]' && $r['title'] === 'No answer from the driver');

        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertStatus(409);

        $next = $this->book(['start_at' => self::at('2026-10-15 09:00')]);
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$next['id']}/decline")->assertOk()->assertJsonPath('status', 'declined');
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[customer]' && $r['title'] === 'Driver unavailable');
    }

    /** @test */
    public function hires_are_private_to_their_customer_and_driver()
    {
        $hire = $this->book();
        $stranger = $this->hireDriver('Stranger', '+250788555555');

        Sanctum::actingAs($stranger);
        $this->getJson("/api/driver-hire/{$hire['id']}")->assertNotFound();
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertNotFound();
        $this->postJson("/api/driver-hire/{$hire['id']}/cancel", ['reason' => 'other'])->assertNotFound();
        $this->getJson('/api/driver/hires')->assertOk()->assertJsonCount(0);

        Sanctum::actingAs($this->customer);
        $this->postJson("/api/driver-hire/{$hire['id']}/accept")->assertForbidden();   // customers can't act as drivers
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/driver-hire')->assertUnauthorized();
    }
}
