<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * S25.1: a shared journey's ordered stops with the time at each stop and the
 * fare to the next stop. A passenger's fare is the sum of the segments they ride.
 * Listings without stops keep working as one from → to segment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journey_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('private_seat_id')->constrained('private_seats')->cascadeOnDelete();
            $table->unsignedTinyInteger('seq');
            $table->string('name', 80);
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->string('time', 5);                          // HH:MM, departure from this stop
            $table->unsignedInteger('fare_to_next')->nullable(); // RWF per seat to the next stop; null on the last
            $table->timestamps();
            $table->unique(['private_seat_id', 'seq']);
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journey_stops');
    }
};
