<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * S13.7: hire a driver WITH their car — 2/4/8 hour packages with a km
 * allowance; extra time and km are charged at check-out.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_hire_settings', function (Blueprint $table) {
            $table->boolean('offers_car')->default(false);
            $table->foreignId('car_vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();
            $table->unsignedInteger('car_hourly_rate')->nullable();
            $table->unsignedSmallInteger('km_per_hour')->default(15);
            $table->unsignedInteger('extra_km_rate')->nullable();
        });
        Schema::table('driver_hires', function (Blueprint $table) {
            $table->boolean('with_car')->default(false);
            $table->foreignId('vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();
            $table->unsignedInteger('km_allowance')->default(0);
            $table->unsignedInteger('odometer_start')->nullable();
            $table->unsignedInteger('odometer_end')->nullable();
            $table->unsignedInteger('extra_km')->default(0);
            $table->unsignedInteger('extra_km_amount')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('driver_hires', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vehicle_id');
            $table->dropColumn(['with_car', 'km_allowance', 'odometer_start', 'odometer_end', 'extra_km', 'extra_km_amount']);
        });
        Schema::table('driver_hire_settings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('car_vehicle_id');
            $table->dropColumn(['offers_car', 'car_hourly_rate', 'km_per_hour', 'extra_km_rate']);
        });
    }
};
