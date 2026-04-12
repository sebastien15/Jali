<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admin_stations', function (Blueprint $table) {
            $table->string('district')->nullable()->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('admin_stations', function (Blueprint $table) {
            $table->dropColumn('district');
        });
    }
};
