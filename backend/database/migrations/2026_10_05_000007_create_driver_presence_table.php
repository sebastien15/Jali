<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hot table: one row per driver, upserted by the app's heartbeat while online
 * (RIDE_HAILING_PLAN.md §7). A driver counts as online only while
 * last_seen_at is within presence_ttl_sec.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_presence', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_online')->default(false);
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->decimal('heading', 5, 1)->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('online_since')->nullable();
            $table->timestamps();

            $table->index(['is_online', 'last_seen_at']);
            $table->index('lat');
            $table->index('lng');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_presence');
    }
};
