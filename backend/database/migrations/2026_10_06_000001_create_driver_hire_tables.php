<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hire a Driver (epic E6, RIDE_HAILING_PLAN.md §6–7): a verified driver drives
 * the customer's own car by the hour or day.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Each table is skipped if it exists: a failed first deploy had already created the first two
        // S6.1 — the driver's own hire prices (skills live on driver_profiles)
        if (!Schema::hasTable('driver_hire_settings')) Schema::create('driver_hire_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('hourly_rate');
            $table->unsignedTinyInteger('min_hours')->default(2);
            $table->unsignedInteger('daily_rate');
            $table->unsignedTinyInteger('daily_hours')->default(10);
            $table->unsignedInteger('overtime_per_hour');
            $table->unsignedInteger('out_of_town_fee')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // S6.2 — weekly hours (weekday set) and blocked dates (date set, is_blocked)
        if (!Schema::hasTable('driver_availability')) Schema::create('driver_availability', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('weekday')->nullable();   // 0 = Sunday … 6 = Saturday
            $table->date('date')->nullable();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->boolean('is_blocked')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'weekday']);
            $table->index(['user_id', 'date']);
        });

        // S6.3 / S6.4
        if (!Schema::hasTable('driver_hires')) Schema::create('driver_hires', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 30)->default('requested');
            // dateTime, not timestamp: MySQL without explicit_defaults_for_timestamp rejects a second
            // NOT NULL timestamp column ("Invalid default value"), which broke the production deploy
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->string('duration_type', 10);                     // hours|days
            $table->unsignedSmallInteger('duration_value');
            $table->string('trip_type', 20);                         // city|out_of_town|airport
            $table->string('transmission', 20);                      // automatic|manual
            $table->decimal('pickup_lat', 10, 7);
            $table->decimal('pickup_lng', 10, 7);
            $table->string('pickup_address')->nullable();
            $table->string('car_description', 200)->nullable();
            $table->string('notes', 500)->nullable();
            // Price lock: everything needed to explain the price later
            $table->json('rate_snapshot');
            $table->unsignedInteger('driver_total');                 // driver's price for the booked time
            $table->unsignedInteger('service_fee');
            $table->unsignedInteger('quoted_total');                 // what the customer pays = driver_total + service_fee
            $table->decimal('commission_pct', 5, 2);
            $table->unsignedInteger('overtime_minutes')->default(0);
            $table->unsignedInteger('overtime_amount')->default(0);
            $table->unsignedInteger('final_total')->nullable();
            $table->unsignedInteger('commission')->nullable();
            $table->unsignedInteger('cancel_fee')->default(0);
            $table->string('cancel_reason')->nullable();
            $table->string('cancelled_by', 10)->nullable();          // customer|driver
            $table->string('payment_method', 20)->nullable();        // cash|momo
            $table->dateTime('requested_at');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('checked_in_at')->nullable();
            $table->timestamp('checked_out_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['driver_id', 'status', 'start_at']);
            $table->index(['customer_id', 'created_at']);
            $table->index('status');
        });

        if (!Schema::hasTable('hire_ratings')) Schema::create('hire_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_hire_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('stars');
            $table->json('tags')->nullable();
            $table->string('comment', 500)->nullable();
            $table->timestamps();

            $table->unique(['driver_hire_id', 'from_user_id']);
            $table->index('to_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hire_ratings');
        Schema::dropIfExists('driver_hires');
        Schema::dropIfExists('driver_availability');
        Schema::dropIfExists('driver_hire_settings');
    }
};
