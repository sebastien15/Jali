<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create("location_change_requests", function (Blueprint $table) {
            $table->id();
            $table
                ->foreignId("admin_id")
                ->constrained("users")
                ->onDelete("cascade");
            $table
                ->foreignId("from_location_id")
                ->nullable()
                ->constrained("locations")
                ->onDelete("set null");
            $table
                ->foreignId("to_location_id")
                ->constrained("locations")
                ->onDelete("cascade");
            $table
                ->enum("status", ["pending", "approved", "rejected"])
                ->default("pending");
            $table
                ->foreignId("superadmin_id")
                ->nullable()
                ->constrained("users")
                ->onDelete("set null");
            $table->timestamp("approved_at")->nullable();
            $table->timestamps();

            $table->index(["admin_id", "status"]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists("location_change_requests");
    }
};
