<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stories S7.1, S7.2, S5.4 — what each driver earned and owes Jali.
 * balance > 0: Jali owes the driver · balance < 0: the driver owes Jali.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('source_type', 20);                  // ride|hire|settlement|payout|adjustment
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('type', 20);                         // earning|commission|settlement|payout|adjustment
            $table->integer('amount');                          // what happened (RWF)
            $table->integer('balance_effect');                  // how it moves the balance (cash earnings: 0)
            $table->integer('balance_after');
            $table->string('note')->nullable();
            $table->timestamp('created_at');

            $table->unique(['source_type', 'source_id', 'type']);
            $table->index(['user_id', 'id']);
        });

        Schema::create('driver_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount');
            $table->string('method', 20)->default('momo');
            $table->string('reference', 100);
            $table->string('status', 20)->default('pending');   // pending|confirmed|rejected
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });

        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->string('momo_number', 20)->nullable();
            $table->string('momo_name', 100)->nullable();
        });

        // Drivers use the same cash-out table as admins (S7.2)
        Schema::table('cashout_requests', function (Blueprint $table) {
            $table->string('requester_type', 10)->default('admin')->after('admin_id');
        });
    }

    public function down(): void
    {
        Schema::table('cashout_requests', fn (Blueprint $table) => $table->dropColumn('requester_type'));
        Schema::table('driver_profiles', fn (Blueprint $table) => $table->dropColumn(['momo_number', 'momo_name']));
        Schema::dropIfExists('driver_settlements');
        Schema::dropIfExists('driver_ledger');
    }
};
