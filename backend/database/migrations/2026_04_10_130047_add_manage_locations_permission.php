<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Permission;
use App\Models\Role;

return new class extends Migration {
    public function up(): void
    {
        $perm = Permission::firstOrCreate(["name" => "manage-locations"]);

        // Assign to superadmin only
        $superadmin = Role::where("name", "superadmin")->first();
        if ($superadmin) {
            $superadmin->permissions()->syncWithoutDetaching([$perm->id]);
        }
    }

    public function down(): void
    {
        Permission::where("name", "manage-locations")->delete();
    }
};
