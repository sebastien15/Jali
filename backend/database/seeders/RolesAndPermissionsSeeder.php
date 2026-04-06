<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Create permissions
        $permissions = [
            'create-bookings' => 'Create bookings',
            'view-own-bookings' => 'View own bookings',
            'upload-tickets' => 'Upload ticket photos',
            'confirm-bookings' => 'Confirm bookings',
            'create-private-seats' => 'Create private seat listings',
            'view-own-earnings' => 'View own earnings',
            'view-analytics' => 'View analytics dashboard',
            'manage-users' => 'Manage users',
            'manage-admins' => 'Manage admin assignments',
            'view-station-analytics' => 'View station-specific analytics',
        ];

        foreach ($permissions as $name => $desc) {
            Permission::firstOrCreate(
                ['name' => $name],
                ['description' => $desc]
            );
        }

        // Create roles
        $superadmin = Role::firstOrCreate(
            ['name' => 'superadmin'],
            ['description' => 'Full system access']
        );
        $admin = Role::firstOrCreate(
            ['name' => 'admin'],
            ['description' => 'Bus station manager']
        );
        $user = Role::firstOrCreate(
            ['name' => 'user'],
            ['description' => 'Passenger']
        );
        $driver = Role::firstOrCreate(
            ['name' => 'driver'],
            ['description' => 'Private driver']
        );

        // Assign permissions to roles
        $superadmin->permissions()->sync(Permission::all());

        $admin->permissions()->sync(
            Permission::whereIn('name', ['upload-tickets', 'confirm-bookings', 'view-station-analytics'])->get()
        );

        $user->permissions()->sync(
            Permission::whereIn('name', ['create-bookings', 'view-own-bookings'])->get()
        );

        $driver->permissions()->sync(
            Permission::whereIn('name', ['create-private-seats', 'view-own-earnings'])->get()
        );
    }
}
