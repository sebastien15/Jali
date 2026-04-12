<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agency_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->foreignId('from_station_id')->constrained('admin_stations')->cascadeOnDelete();
            $table->foreignId('to_station_id')->constrained('admin_stations')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['agency_id', 'from_station_id', 'to_station_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agency_routes');
    }
};
