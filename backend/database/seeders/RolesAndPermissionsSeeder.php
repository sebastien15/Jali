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
            'manage-buses' => 'Create, edit and delete bus routes',
            'manage-users' => 'Manage users',
            'manage-admins' => 'Manage admin assignments',
            'manage-locations' => 'Manage pickup/dropoff locations',
            'view-station-analytics' => 'View station-specific analytics',
            'manage-agencies' => 'Create, edit and delete agencies and trips',
        ];

        foreach ($permissions as $name => $desc) {
            Permission::firstOrCreate(
                ['name' => $name],
                ['description' => $desc]
            );
        }

        // On-demand rides & hire-a-driver (RIDE_HAILING_PLAN.md §8)
        $ridePermissions = [
            'request-rides' => 'Request on-demand rides and hire drivers',
            'offer-rides' => 'Go online and accept ride requests',
            'offer-driver-hire' => 'Offer hire-a-driver services',
            'verify-drivers' => 'Review and verify driver applications',
            'manage-rides' => 'Monitor rides and handle disputes',
            'manage-ride-pricing' => 'Configure ride pricing guardrails',
            'apply-as-driver' => 'Apply to drive: profile, vehicles and documents',
        ];

        foreach ($ridePermissions as $name => $desc) {
            Permission::firstOrCreate(
                ['name' => $name],
                ['description' => $desc, 'category' => 'Rides']
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
            Permission::whereIn('name', [
                'upload-tickets', 'confirm-bookings', 'manage-buses',
                'view-analytics', 'view-station-analytics', 'manage-agencies',
                'manage-locations', 'request-rides', 'verify-drivers', 'manage-rides', 'apply-as-driver',
            ])->get()
        );

        $user->permissions()->sync(
            Permission::whereIn('name', ['create-bookings', 'view-own-bookings', 'request-rides', 'apply-as-driver'])->get()
        );

        $driver->permissions()->sync(
            Permission::whereIn('name', [
                'create-private-seats', 'view-own-earnings',
                'request-rides', 'offer-rides', 'offer-driver-hire', 'apply-as-driver',
            ])->get()
        );
    }
}
