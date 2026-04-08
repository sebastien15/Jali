<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('car_rentals', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->integer('caution')->default(0)->after('price');
            $table->json('amenities')->nullable()->after('active');
            $table->json('photos')->nullable()->after('amenities');
        });
    }

    public function down(): void
    {
        Schema::table('car_rentals', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['user_id', 'caution', 'amenities', 'photos']);
        });
    }
};
