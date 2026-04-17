<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add operating_hours to agencies
        Schema::table('agencies', function (Blueprint $table) {
            $table->string('operating_hours', 100)->nullable()->after('name');
        });

        // Cashout preference columns on users
        Schema::table('users', function (Blueprint $table) {
            $table->string('cashout_method', 20)->nullable()->after('profile_image_url');      // 'bank' | 'mobile'
            $table->string('cashout_account_number', 50)->nullable()->after('cashout_method');
            $table->string('cashout_account_name', 100)->nullable()->after('cashout_account_number');
            $table->string('cashout_bank_name', 100)->nullable()->after('cashout_account_name');
        });

        // Cashout requests
        Schema::create('cashout_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('method', 20);                   // 'bank' | 'mobile'
            $table->string('account_number', 50);
            $table->string('account_name', 100)->nullable();
            $table->string('bank_name', 100)->nullable();
            $table->string('status', 20)->default('pending'); // pending|processing|completed|rejected
            $table->text('note')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn('operating_hours');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['cashout_method', 'cashout_account_number', 'cashout_account_name', 'cashout_bank_name']);
        });
        Schema::dropIfExists('cashout_requests');
    }
};
