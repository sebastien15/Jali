<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Vehicle/onboarding details submitted from the driver setup screen,
     * which were previously discarded by PATCH /driver/profile.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('driver_profile')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('driver_profile');
        });
    }
};
