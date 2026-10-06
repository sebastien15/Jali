<?php

namespace Tests\Feature;

use App\Models\AdminStation;
use App\Models\AgencyRoute;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StationAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_station_name_aliases_and_province_can_be_set(): void
    {
        $this->actingAsRole('superadmin');

        $id = $this->postJson('/api/admin/stations', [
            'city' => 'Kigali', 'name' => 'Kimironko Stop', 'province' => 'Kigali City', 'aliases' => ['Kimironko'],
        ])->assertCreated()->json('id');

        $this->patchJson("/api/admin/stations/{$id}", ['name' => 'Kimironko Market'])->assertOk()
            ->assertJsonPath('name', 'Kimironko Market')
            ->assertJsonPath('aliases.0', 'Kimironko')
            ->assertJsonPath('province', 'Kigali City');
    }

    public function test_station_used_by_routes_cannot_be_deleted(): void
    {
        $this->seed();
        $this->actingAsRole('superadmin');
        $stationId = AgencyRoute::value('from_station_id');

        $this->deleteJson("/api/admin/stations/{$stationId}")->assertStatus(409);
        $this->assertNotNull(AdminStation::find($stationId));
    }

    public function test_only_admins_can_be_assigned_to_a_station(): void
    {
        $passenger = $this->makeUser('user');
        $this->actingAsRole('superadmin');

        $this->postJson('/api/admin/stations', ['city' => 'Huye', 'admin_id' => $passenger->id])->assertStatus(422);
    }
}
