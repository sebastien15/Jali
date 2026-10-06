<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * On-demand rides (RIDE_HAILING_PLAN.md §5, §7).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rider_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->string('mode', 20)->default('pick');            // pick|broadcast
            $table->string('vehicle_class', 20);
            $table->string('status', 30)->default('requested');
            $table->decimal('pickup_lat', 10, 7);
            $table->decimal('pickup_lng', 10, 7);
            $table->string('pickup_address')->nullable();
            $table->decimal('dropoff_lat', 10, 7);
            $table->decimal('dropoff_lng', 10, 7);
            $table->string('dropoff_address')->nullable();
            $table->decimal('est_distance_km', 6, 1);
            $table->unsignedSmallInteger('est_minutes');
            $table->decimal('pickup_km', 6, 1)->default(0);
            // Price lock (S2.3): everything needed to explain the fare later
            $table->json('rate_snapshot');
            $table->unsignedInteger('driver_fare');
            $table->unsignedInteger('service_fee');
            $table->unsignedInteger('quoted_fare');                  // what the rider pays = driver_fare + service_fee
            $table->decimal('commission_pct', 5, 2);
            $table->unsignedInteger('commission')->nullable();
            $table->unsignedInteger('final_fare')->nullable();
            $table->unsignedInteger('cancel_fee')->default(0);
            $table->char('start_pin', 4);
            $table->unsignedTinyInteger('pin_attempts')->default(0);
            $table->string('payment_method', 20)->nullable();       // cash|momo
            $table->string('cancel_reason')->nullable();
            $table->string('cancelled_by', 10)->nullable();         // rider|driver|system
            $table->timestamp('requested_at');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('arrived_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('flagged_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index(['rider_id', 'created_at']);
            $table->index(['driver_id', 'status']);
        });

        Schema::create('ride_dispatches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ride_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('quote');
            $table->string('status', 20)->default('sent');          // sent|accepted|declined|expired|withdrawn
            $table->timestamp('sent_at');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->index(['driver_id', 'status']);
        });

        // Append-only audit trail (S8.3)
        Schema::create('ride_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ride_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 40);
            $table->json('payload')->nullable();
            $table->timestamp('created_at');

            $table->index(['ride_id', 'id']);
        });

        Schema::create('ride_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ride_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('stars');
            $table->json('tags')->nullable();
            $table->string('comment', 500)->nullable();
            $table->timestamps();

            $table->unique(['ride_id', 'from_user_id']);
            $table->index('to_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ride_ratings');
        Schema::dropIfExists('ride_events');
        Schema::dropIfExists('ride_dispatches');
        Schema::dropIfExists('rides');
    }
};
