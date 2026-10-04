<?php

namespace Tests\Feature;

use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_superadmin_can_change_a_users_role(): void
    {
        $target = $this->makeUser('user');
        $this->actingAsRole('superadmin');

        $this->patchJson("/api/admin/users/{$target->id}", ['role' => 'driver'])->assertOk()->assertJsonPath('role', 'driver');
    }

    public function test_superadmin_cannot_change_own_role(): void
    {
        $me = $this->actingAsRole('superadmin');
        $this->makeUser('superadmin');

        $this->patchJson("/api/admin/users/{$me->id}", ['role' => 'user'])->assertStatus(422);
    }

    public function test_last_superadmin_cannot_be_demoted(): void
    {
        $only = $this->makeUser('superadmin');
        // acting user has manage-users but is not a superadmin (custom role)
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $hr = Role::create(['name' => 'hr']);
        $hr->permissions()->sync(\App\Models\Permission::where('name', 'manage-users')->pluck('id'));
        $this->actingAsRole('hr');

        $this->patchJson("/api/admin/users/{$only->id}", ['role' => 'user'])->assertStatus(422);
        $this->assertTrue($only->fresh()->isSuperAdmin());
    }

    public function test_system_roles_cannot_be_renamed(): void
    {
        $this->actingAsRole('superadmin');
        $admin = Role::where('name', 'admin')->first();

        $this->patchJson("/api/admin/roles/{$admin->id}", ['name' => 'boss'])->assertStatus(422);
        $this->patchJson("/api/admin/roles/{$admin->id}", ['description' => 'Station agent'])->assertOk();
    }

    public function test_non_superadmin_cannot_manage_users(): void
    {
        $target = $this->makeUser('user');
        $this->actingAsRole('admin');

        $this->patchJson("/api/admin/users/{$target->id}", ['role' => 'superadmin'])->assertForbidden();
    }
}
