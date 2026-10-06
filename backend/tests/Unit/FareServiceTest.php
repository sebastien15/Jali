<?php

namespace Tests\Unit;

use App\Modules\NearbyRides\Application\FareService;
use App\Modules\Locations\Application\GeoService;
use App\Modules\Pricing\Application\RideSettings;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FareServiceTest extends TestCase
{
    use RefreshDatabase;

    private array $rates = [
        'base_fare' => 500, 'per_km' => 400, 'per_min' => 0, 'min_fare' => 1500,
        'pickup_free_km' => 2, 'pickup_per_km' => 200, 'night_multiplier' => 1.2,
    ];

    private function day(): CarbonImmutable
    {
        return CarbonImmutable::parse('2026-10-05 14:00', FareService::TIMEZONE);
    }

    /** @test */
    public function standard_trip_uses_base_plus_per_km_plus_flat_service_fee()
    {
        $q = (new FareService())->quote($this->rates, 5.0, 1.0, 0, $this->day());

        $this->assertSame(2500, $q['driver_fare']);   // 500 + 5×400
        $this->assertSame(0, $q['service_fee']);      // S7.4: no Jali fee by default
        $this->assertSame(2500, $q['total']);
        $this->assertFalse($q['is_night']);
    }

    /** @test */
    public function short_trips_pay_the_minimum_fare()
    {
        $q = (new FareService())->quote($this->rates, 0.8, 0, 0, $this->day());

        $this->assertSame(1500, $q['driver_fare']);
    }

    /** @test */
    public function pickup_beyond_the_free_distance_is_charged()
    {
        $q = (new FareService())->quote($this->rates, 5.0, 4.5, 0, $this->day());

        $this->assertSame(3000, $q['driver_fare']);   // 2500 + 2.5 km × 200
    }

    /** @test */
    public function night_multiplier_applies_between_22h_and_5h_kigali_time()
    {
        $service = new FareService();
        $night = CarbonImmutable::parse('2026-10-05 23:30', FareService::TIMEZONE);
        $earlyMorning = CarbonImmutable::parse('2026-10-06 04:59', FareService::TIMEZONE);
        $morning = CarbonImmutable::parse('2026-10-06 05:00', FareService::TIMEZONE);

        $this->assertSame(3000, $service->quote($this->rates, 5.0, 0, 0, $night)['driver_fare']); // 2500 × 1.2
        $this->assertTrue($service->quote($this->rates, 5.0, 0, 0, $earlyMorning)['is_night']);
        $this->assertFalse($service->quote($this->rates, 5.0, 0, 0, $morning)['is_night']);
        // 22:00 UTC is 00:00 in Kigali
        $this->assertTrue(FareService::isNight(CarbonImmutable::parse('2026-10-05 22:00', 'UTC')));
    }

    /** @test */
    public function fares_round_up_to_the_next_100_rwf()
    {
        $q = (new FareService())->quote($this->rates, 3.33, 0, 0, $this->day());

        $this->assertSame(1900, $q['driver_fare']);   // 500 + 1332 = 1832 → 1900
        $this->assertSame(2000, FareService::roundUpTo100(2000.0000001));
        $this->assertSame(2100, FareService::roundUpTo100(2000.5));
    }

    /** @test */
    public function per_minute_charge_is_added()
    {
        $q = (new FareService())->quote(['per_min' => 50] + $this->rates, 5.0, 0, 10, $this->day());

        $this->assertSame(3000, $q['driver_fare']);   // 2500 + 10 × 50
    }

    /** @test */
    public function percent_service_fee_follows_settings()
    {
        RideSettings::update(['service_fee' => ['type' => 'percent', 'amount' => 5]], User::create(['name' => 'sa']));

        $q = (new FareService())->quote($this->rates, 5.0, 0, 0, $this->day());

        $this->assertSame(125, $q['service_fee']);   // 5% of 2500
        $this->assertSame(2625, $q['total']);
    }

    /** @test */
    public function road_distance_is_haversine_times_road_factor()
    {
        // Nyabugogo → Kigali Convention Centre ≈ 4.4 km straight line
        $straight = GeoService::haversineKm(-1.9420, 30.0562, -1.9535, 30.0937);
        $this->assertEqualsWithDelta(4.36, $straight, 0.1);
        $this->assertEqualsWithDelta(round($straight * 1.3, 1), GeoService::roadKm(-1.9420, 30.0562, -1.9535, 30.0937), 0.001);
    }
}
