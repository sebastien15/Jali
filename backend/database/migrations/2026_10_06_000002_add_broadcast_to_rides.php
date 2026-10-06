<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Story S3.5 — send a request to several nearby drivers under a maximum price */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rides', function (Blueprint $table) {
            $table->unsignedInteger('max_fare')->nullable()->after('quoted_fare');
        });
        Schema::table('ride_dispatches', function (Blueprint $table) {
            // Each driver's own locked price for a broadcast (driver_fare, service_fee, total, rate, vehicle…)
            $table->json('fare')->nullable()->after('quote');
        });
    }

    public function down(): void
    {
        Schema::table('ride_dispatches', fn (Blueprint $table) => $table->dropColumn('fare'));
        Schema::table('rides', fn (Blueprint $table) => $table->dropColumn('max_fare'));
    }
};
