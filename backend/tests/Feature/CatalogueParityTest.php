<?php

namespace Tests\Feature;

use App\Models\CarRental;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Characterization of the public catalogues before/after the M03 module moves:
 * filters, ordering and the raw (unmapped) response shape.
 */
class CatalogueParityTest extends TestCase
{
    use RefreshDatabase;

    private function car(array $overrides = []): CarRental
    {
        return CarRental::create(array_merge([
            'user_id' => null, 'name' => 'Car', 'type' => 'Sedan', 'price' => 30000, 'seats' => 4, 'plate' => 'P', 'active' => true,
        ], $overrides));
    }

    public function test_rental_catalogue_filters_orders_and_keeps_raw_shape(): void
    {
        $suvDear  = $this->car(['name' => 'Prado', 'type' => 'SUV', 'price' => 90000]);
        $sedan    = $this->car(['name' => 'Corolla', 'price' => 30000]);
        $suvCheap = $this->car(['name' => 'RAV4', 'type' => 'SUV', 'price' => 50000]);
        $this->car(['name' => 'Off', 'active' => false]);
        $this->car(['name' => 'Rented', 'status' => 'rented']);
        $this->actingAsRole('user');

        $all = $this->getJson('/api/car-rentals')->assertOk()->json();
        $this->assertSame([$sedan->id, $suvCheap->id, $suvDear->id], array_column($all, 'id'));
        $this->assertArrayNotHasKey('priceDay', $all[0]);
        $this->assertSame('available', $all[0]['status']);

        $this->assertSame([$suvCheap->id, $suvDear->id], array_column($this->getJson('/api/car-rentals?type=SUV')->assertOk()->json(), 'id'));
        $this->assertCount(3, $this->getJson('/api/car-rentals?type=')->assertOk()->json());
    }
}
