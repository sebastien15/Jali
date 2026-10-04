<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The driver screens send listing notes and car status/notes, and the
     * controllers validate them, but the columns never existed so the
     * values were silently dropped.
     */
    public function up(): void
    {
        Schema::table('private_seats', function (Blueprint $table) {
            $table->text('notes')->nullable();
        });
        Schema::table('car_rentals', function (Blueprint $table) {
            $table->string('status', 20)->default('available');
            $table->text('notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('private_seats', function (Blueprint $table) {
            $table->dropColumn('notes');
        });
        Schema::table('car_rentals', function (Blueprint $table) {
            $table->dropColumn(['status', 'notes']);
        });
    }
};
