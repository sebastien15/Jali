<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Key/value platform configuration editable by the superadmin.
 * `rides` holds pricing guardrails (RIDE_HAILING_PLAN.md §3.3); the payment
 * plan (PAYMENT_SYSTEM_PLAN.md) can store its config under its own key.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique();
            $table->json('value');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
    }
};
