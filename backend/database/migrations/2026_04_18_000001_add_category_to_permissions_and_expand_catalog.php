<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('permissions', 'category')) {
            Schema::table('permissions', function (Blueprint $table) {
                $table->string('category', 50)->nullable()->after('description');
            });
        }

        $permissions = [
            ['name' => 'confirm-bookings',      'description' => 'Confirm bookings',                    'category' => 'Bookings'],
            ['name' => 'upload-tickets',         'description' => 'Upload ticket photos',                'category' => 'Bookings'],
            ['name' => 'create-bookings',        'description' => 'Create bookings',                     'category' => 'Bookings'],
            ['name' => 'view-own-bookings',      'description' => 'View own bookings',                   'category' => 'Bookings'],
            ['name' => 'manage-agencies',        'description' => 'Manage agencies and trips',           'category' => 'Agencies'],
            ['name' => 'agencies.create',        'description' => 'Create agencies',                     'category' => 'Agencies'],
            ['name' => 'agencies.update',        'description' => 'Update agencies',                     'category' => 'Agencies'],
            ['name' => 'agencies.delete',        'description' => 'Delete agencies',                     'category' => 'Agencies'],
            ['name' => 'agencies.routes',        'description' => 'Manage agency routes',                'category' => 'Agencies'],
            ['name' => 'manage-locations',       'description' => 'Manage pickup/dropoff locations',     'category' => 'Locations'],
            ['name' => 'locations.create',       'description' => 'Create locations',                    'category' => 'Locations'],
            ['name' => 'locations.update',       'description' => 'Update locations',                    'category' => 'Locations'],
            ['name' => 'locations.delete',       'description' => 'Delete locations',                    'category' => 'Locations'],
            ['name' => 'view-analytics',         'description' => 'View analytics dashboard',            'category' => 'Analytics'],
            ['name' => 'view-station-analytics', 'description' => 'View station analytics',              'category' => 'Analytics'],
            ['name' => 'manage-buses',           'description' => 'Manage bus routes',                   'category' => 'Buses'],
            ['name' => 'manage-users',           'description' => 'Manage users',                        'category' => 'Users'],
            ['name' => 'manage-admins',          'description' => 'Manage admin assignments',            'category' => 'Admins'],
            ['name' => 'create-private-seats',   'description' => 'Create private seat listings',        'category' => 'Driver'],
            ['name' => 'view-own-earnings',      'description' => 'View own earnings',                   'category' => 'Driver'],
            ['name' => 'manage-roles',           'description' => 'Manage roles and permissions',        'category' => 'Admins'],
        ];

        foreach ($permissions as $p) {
            DB::table('permissions')->updateOrInsert(
                ['name' => $p['name']],
                ['description' => $p['description'], 'category' => $p['category'], 'updated_at' => now()]
            );
        }

        // Ensure superadmin has all permissions
        $superadmin = DB::table('roles')->where('name', 'superadmin')->first();
        if ($superadmin) {
            $allPermissionIds = DB::table('permissions')->pluck('id');
            foreach ($allPermissionIds as $permId) {
                DB::table('role_permissions')->insertOrIgnore([
                    'role_id'       => $superadmin->id,
                    'permission_id' => $permId,
                ]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('permissions', 'category')) {
            Schema::table('permissions', function (Blueprint $table) {
                $table->dropColumn('category');
            });
        }
    }
};
