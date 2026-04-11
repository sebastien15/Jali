<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table("users", function (Blueprint $table) {
            $table
                ->foreignId("role_id")
                ->nullable()
                ->after("id")
                ->constrained("roles")
                ->onDelete("set null");
        });

        // Populate role_id from existing pivot table
        DB::statement("
            UPDATE users
            SET role_id = (
                SELECT role_id FROM user_roles WHERE user_roles.user_id = users.id LIMIT 1
            )
        ");

        // Drop the old pivot table if it exists
        Schema::dropIfExists("user_roles");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create("user_roles", function (Blueprint $table) {
            $table
                ->foreignId("user_id")
                ->constrained("users")
                ->onDelete("cascade");
            $table
                ->foreignId("role_id")
                ->constrained("roles")
                ->onDelete("cascade");
            $table->primary(["user_id", "role_id"]);
        });

        Schema::table("users", function (Blueprint $table) {
            $table->dropForeign(["role_id"]);
            $table->dropColumn("role_id");
        });
    }
};
