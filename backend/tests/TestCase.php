<?php

namespace Tests;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    /**
     * Create a user with the given role (seeding roles/permissions on first use).
     */
    protected function makeUser(string $role = 'user', array $attributes = []): User
    {
        if (!Role::where('name', $role)->exists()) {
            $this->seed(RolesAndPermissionsSeeder::class);
        }

        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', $role)->value('id'),
        ], $attributes))->load('role');
    }

    /**
     * Create a user with the given role and authenticate as them via Sanctum.
     */
    protected function actingAsRole(string $role = 'user', array $attributes = []): User
    {
        $user = $this->makeUser($role, $attributes);
        Sanctum::actingAs($user);

        return $user;
    }
}
