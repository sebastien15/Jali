<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Epic E8 — share trip (S8.1), SOS (S8.2), driver review (S8.4) */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rides', function (Blueprint $table) {
            $table->string('share_token', 64)->nullable()->unique();
            $table->dateTime('sos_at')->nullable();
            $table->foreignId('sos_by')->nullable()->constrained('users')->nullOnDelete();
        });
        Schema::table('users', function (Blueprint $table) {
            $table->string('emergency_contact_name', 100)->nullable();
            $table->string('emergency_contact_phone', 20)->nullable();
        });
        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->dateTime('warned_at')->nullable();
            $table->string('warning', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('driver_profiles', fn (Blueprint $table) => $table->dropColumn(['warned_at', 'warning']));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['emergency_contact_name', 'emergency_contact_phone']));
        Schema::table('rides', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sos_by');
            $table->dropUnique(['share_token']);
            $table->dropColumn(['share_token', 'sos_at']);
        });
    }
};
