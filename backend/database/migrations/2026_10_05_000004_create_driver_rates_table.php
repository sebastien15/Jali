<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Driver-set prices (RIDE_HAILING_PLAN.md §3.1). One row per driver, vehicle and service.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('service', 20)->default('ride');          // ride|hire
            $table->unsignedInteger('base_fare')->default(0);
            $table->unsignedInteger('per_km')->default(0);
            $table->unsignedInteger('per_min')->default(0);
            $table->unsignedInteger('min_fare')->default(0);
            $table->decimal('pickup_free_km', 4, 1)->default(2);
            $table->unsignedInteger('pickup_per_km')->default(0);
            $table->decimal('night_multiplier', 3, 2)->default(1);
            $table->boolean('is_active')->default(true);
            // Set when superadmin guardrails change and these rates fall outside them
            $table->timestamp('out_of_band_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'vehicle_id', 'service']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_rates');
    }
};
