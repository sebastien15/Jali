<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'profile_image_url')) {
                $table->mediumText('profile_image_url')->nullable()->change();
            } else {
                $table->mediumText('profile_image_url')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'profile_image_url')) {
                $table->mediumText('profile_image_url')->nullable()->change();
            }
        });
    }
};
