<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Driver profile + vehicles (RIDE_HAILING_PLAN.md §7).
 * Holds the data driver/setup.tsx collects, which was previously discarded.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('services')->nullable();              // ["ride","hire","private_seat","rental"]
            $table->json('allowed_zones')->nullable();
            $table->string('docs_url', 2048)->nullable();
            $table->string('national_id_no', 50)->nullable();
            $table->string('licence_no', 50)->nullable();
            $table->json('licence_categories')->nullable();
            $table->date('licence_expiry')->nullable();
            $table->json('transmissions')->nullable();         // ["automatic","manual"]
            $table->json('languages')->nullable();
            $table->unsignedTinyInteger('years_experience')->nullable();
            $table->string('verification_status', 20)->default('pending'); // pending|verified|rejected|suspended
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->decimal('rating_avg', 2, 1)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('trips_count')->default(0);
            $table->timestamps();
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('class', 20)->default('car');       // moto|car|comfort|van
            $table->string('body_type', 30)->nullable();       // Sedan|SUV|Minivan|Pickup
            $table->string('make', 50)->nullable();
            $table->string('model', 100);
            $table->string('color', 30)->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('plate', 20)->unique();
            $table->unsignedTinyInteger('seats')->default(4);
            $table->json('amenities')->nullable();
            $table->json('photos')->nullable();
            $table->date('insurance_expiry')->nullable();
            $table->unsignedInteger('rental_price_day')->nullable();
            $table->unsignedInteger('rental_caution')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
        Schema::dropIfExists('driver_profiles');
    }
};
