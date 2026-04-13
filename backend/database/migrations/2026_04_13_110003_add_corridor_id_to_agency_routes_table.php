<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agency_routes', function (Blueprint $table) {
            $table->foreignId('corridor_id')
                ->nullable()
                ->after('agency_id')
                ->constrained('corridors')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('agency_routes', function (Blueprint $table) {
            $table->dropForeign(['corridor_id']);
            $table->dropColumn('corridor_id');
        });
    }
};
