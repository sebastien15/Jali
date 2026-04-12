<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admin_stations', function (Blueprint $table) {
            // Make user_id nullable so a station can exist without an admin
            $table->foreignId('user_id')->nullable()->change();

            // New fields
            $table->enum('type', ['bus_station', 'custom'])->default('bus_station')->after('city');
            $table->string('address')->nullable()->after('type');
            $table->decimal('latitude', 10, 8)->nullable()->after('address');
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            $table->string('image_url')->nullable()->after('longitude');
        });
    }

    public function down(): void
    {
        Schema::table('admin_stations', function (Blueprint $table) {
            $table->dropColumn(['type', 'address', 'latitude', 'longitude', 'image_url']);
            $table->foreignId('user_id')->nullable(false)->change();
        });
    }
};
