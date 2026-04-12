<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->foreignId('from_station_id')->constrained('admin_stations');
            $table->foreignId('to_station_id')->constrained('admin_stations');
            $table->time('departure_time');           // e.g. "08:00"
            $table->time('estimated_arrival_time');   // e.g. "11:30"
            $table->unsignedInteger('price');         // RWF, no decimals
            $table->unsignedInteger('total_seats')->default(30);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
