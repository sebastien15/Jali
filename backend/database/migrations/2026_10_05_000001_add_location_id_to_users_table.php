<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * users.location_id is read/written by User::location(), location change
     * requests and LocationController, but no migration ever created it.
     */
    public function up(): void
    {
        if (Schema::hasColumn('users', 'location_id')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('location_id')->nullable()->after('role_id')
                ->constrained('locations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('users', 'location_id')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('location_id');
        });
    }
};
