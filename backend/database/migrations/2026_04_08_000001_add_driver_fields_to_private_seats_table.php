<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('private_seats', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->string('pickup_station')->nullable()->after('from');
            $table->string('drop_location')->nullable()->after('to');
            $table->string('date')->nullable()->after('dep');
            $table->boolean('active')->default(true)->after('rating');
            $table->json('amenities')->nullable()->after('active');
            $table->boolean('group_discount')->default(false)->after('amenities');
            $table->integer('group_min_size')->default(3)->after('group_discount');
            $table->integer('group_discount_pct')->default(10)->after('group_min_size');
            $table->boolean('allow_custom_pickup')->default(false)->after('group_discount_pct');
            $table->integer('custom_pickup_fee')->default(0)->after('allow_custom_pickup');
        });
    }

    public function down(): void
    {
        Schema::table('private_seats', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn([
                'user_id', 'pickup_station', 'drop_location', 'date', 'active',
                'amenities', 'group_discount', 'group_min_size', 'group_discount_pct',
                'allow_custom_pickup', 'custom_pickup_fee',
            ]);
        });
    }
};
