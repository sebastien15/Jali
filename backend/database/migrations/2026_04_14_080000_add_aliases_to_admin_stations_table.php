<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admin_stations', function (Blueprint $table) {
            // JSON array of alternative names/spellings (Kinyarwanda, common nicknames, etc.)
            // e.g. ["Gare ya Nyabugogo", "Nyabugogo", "Kigali Bus Park"]
            $table->json('aliases')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('admin_stations', function (Blueprint $table) {
            $table->dropColumn('aliases');
        });
    }
};
