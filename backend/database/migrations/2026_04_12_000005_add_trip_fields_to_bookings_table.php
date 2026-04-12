<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('trip_id')->nullable()->constrained('trips')->nullOnDelete()->after('location_id');
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete()->after('trip_id');
            $table->timestamp('confirmed_at')->nullable()->after('confirmed_by');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['trip_id']);
            $table->dropForeign(['confirmed_by']);
            $table->dropColumn(['trip_id', 'confirmed_by', 'confirmed_at']);
        });
    }
};
