<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * ticket_photo_url was VARCHAR(255). SQLite ignores the length, but on
     * MySQL/Postgres (production) longer storage/CDN URLs fail to save.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->text('ticket_photo_url')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('ticket_photo_url')->nullable()->change();
        });
    }
};
