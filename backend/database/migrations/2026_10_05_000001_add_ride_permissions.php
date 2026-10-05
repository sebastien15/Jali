<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Permissions for on-demand rides and Hire-a-Driver (RIDE_HAILING_PLAN.md §8).
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        'request-rides'       => ['Request on-demand rides and hire drivers', ['superadmin', 'admin', 'user', 'driver']],
        'offer-rides'         => ['Go online and accept ride requests',        ['superadmin', 'driver']],
        'offer-driver-hire'   => ['Offer hire-a-driver services',              ['superadmin', 'driver']],
        'verify-drivers'      => ['Review and verify driver applications',     ['superadmin', 'admin']],
        'manage-rides'        => ['Monitor rides and handle disputes',         ['superadmin', 'admin']],
        'manage-ride-pricing' => ['Configure ride pricing guardrails',         ['superadmin']],
    ];

    public function up(): void
    {
        $roles = DB::table('roles')->pluck('id', 'name');

        foreach (self::PERMISSIONS as $name => [$description, $roleNames]) {
            DB::table('permissions')->updateOrInsert(
                ['name' => $name],
                ['description' => $description, 'category' => 'Rides', 'updated_at' => now(), 'created_at' => now()]
            );
            $permissionId = DB::table('permissions')->where('name', $name)->value('id');

            foreach ($roleNames as $roleName) {
                if (isset($roles[$roleName])) {
                    DB::table('role_permissions')->insertOrIgnore([
                        'role_id'       => $roles[$roleName],
                        'permission_id' => $permissionId,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        // role_permissions rows are removed by the cascading foreign key
        DB::table('permissions')->whereIn('name', array_keys(self::PERMISSIONS))->delete();
    }
};
