<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Ensure the permission row exists
        $existing = DB::table('permissions')->where('name', 'confirm-bookings')->first();
        if (!$existing) {
            DB::table('permissions')->insert([
                'name'        => 'confirm-bookings',
                'description' => 'Confirm bookings',
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        $permissionId = DB::table('permissions')->where('name', 'confirm-bookings')->value('id');
        $adminRole    = DB::table('roles')->where('name', 'admin')->first();

        if ($adminRole && $permissionId) {
            $alreadyLinked = DB::table('role_permissions')
                ->where('role_id', $adminRole->id)
                ->where('permission_id', $permissionId)
                ->exists();

            if (!$alreadyLinked) {
                DB::table('role_permissions')->insert([
                    'role_id'       => $adminRole->id,
                    'permission_id' => $permissionId,
                ]);
            }
        }
    }

    public function down(): void
    {
        // intentionally a no-op — removing permissions in rollback would break live data
    }
};
