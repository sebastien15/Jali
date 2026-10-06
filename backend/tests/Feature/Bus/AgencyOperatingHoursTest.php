<?php

namespace Tests\Feature\Bus;

use App\Models\Agency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Authorized fix (M03-Remaining item 5): PATCH /admin/agencies/{id} used to
 * answer 200 but drop operating_hours, because it was missing from
 * Agency::$fillable. Regular admins may change only operating_hours;
 * superadmins may also rename the agency and clear the hours.
 */
class AgencyOperatingHoursTest extends TestCase
{
    use RefreshDatabase;

    public function test_station_admin_saves_operating_hours_but_cannot_rename(): void
    {
        $agency = Agency::create(['name' => 'Alpha Express']);
        $this->actingAsRole('admin');

        $this->patchJson("/api/admin/agencies/{$agency->id}", ['name' => 'Renamed', 'operating_hours' => '05:00-22:00'])->assertOk()
            ->assertJsonPath('name', 'Alpha Express')->assertJsonPath('operating_hours', '05:00-22:00');

        $fresh = $agency->fresh();
        $this->assertSame('05:00-22:00', $fresh->operating_hours);
        $this->assertSame('Alpha Express', $fresh->name);
        $this->assertSame('05:00-22:00', $this->getJson("/api/admin/agencies/{$agency->id}")->json('operating_hours'));
    }

    public function test_superadmin_sets_and_clears_operating_hours(): void
    {
        $agency = Agency::create(['name' => 'Alpha Express']);
        $this->actingAsRole('superadmin');

        $this->patchJson("/api/admin/agencies/{$agency->id}", ['name' => 'Alpha Coach', 'operating_hours' => '06:00-20:00'])->assertOk()
            ->assertJsonPath('name', 'Alpha Coach')->assertJsonPath('operating_hours', '06:00-20:00');
        $this->assertSame('06:00-20:00', $agency->fresh()->operating_hours);

        $this->patchJson("/api/admin/agencies/{$agency->id}", ['operating_hours' => null])->assertOk()->assertJsonPath('operating_hours', null);
        $this->assertNull($agency->fresh()->operating_hours);
    }
}
