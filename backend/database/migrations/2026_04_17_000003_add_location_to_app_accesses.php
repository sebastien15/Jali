<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_accesses', function (Blueprint $table) {
            $table->decimal('lat', 10, 7)->nullable()->after('ip_address');
            $table->decimal('lng', 10, 7)->nullable()->after('lat');
            $table->string('district', 100)->nullable()->after('lng');
        });
    }

    public function down(): void
    {
        Schema::table('app_accesses', function (Blueprint $table) {
            $table->dropColumn(['lat', 'lng', 'district']);
        });
    }
};
