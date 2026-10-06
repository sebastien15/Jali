<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** S23.1: superadmin switches services on/off (release flags in platform_settings['services']). */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        DB::table('permissions')->updateOrInsert(
            ['name' => 'manage-services'],
            ['description' => 'Release, pause or hide services and set the minimum app version', 'category' => 'Platform', 'created_at' => $now, 'updated_at' => $now]
        );
        $permissionId = DB::table('permissions')->where('name', 'manage-services')->value('id');
        foreach (DB::table('roles')->where('name', 'superadmin')->pluck('id') as $roleId) {
            DB::table('role_permissions')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }
    }

    public function down(): void
    {
        DB::table('permissions')->where('name', 'manage-services')->delete();
    }
};
