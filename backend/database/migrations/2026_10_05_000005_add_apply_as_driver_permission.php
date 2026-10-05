<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Driver onboarding (profile, vehicles, documents) is open to every signed-in
 * user so riders can apply to drive (story S1.1). Guarded by its own permission
 * to follow the "every route has a permission" rule.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->updateOrInsert(
            ['name' => 'apply-as-driver'],
            ['description' => 'Apply to drive: profile, vehicles and documents', 'category' => 'Rides',
             'created_at' => now(), 'updated_at' => now()]
        );
        $permissionId = DB::table('permissions')->where('name', 'apply-as-driver')->value('id');

        foreach (DB::table('roles')->whereIn('name', ['superadmin', 'admin', 'user', 'driver'])->pluck('id') as $roleId) {
            DB::table('role_permissions')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }
    }

    public function down(): void
    {
        DB::table('permissions')->where('name', 'apply-as-driver')->delete();
    }
};
