<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * S12.3: one row per push — delivery and open rates per type, and the SMS
 * fallback for critical rider events when the push isn't opened in time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 40);                 // data.screen, e.g. driver_ride
            $table->string('title', 120);
            $table->string('channel', 30)->default('default');
            $table->string('status', 10);               // sent | failed | no_token
            $table->dateTime('opened_at')->nullable();
            $table->string('sms_text', 300)->nullable();
            $table->dateTime('sms_due_at')->nullable();
            $table->dateTime('sms_sent_at')->nullable();
            $table->timestamps();
            $table->index(['type', 'created_at']);
            $table->index(['sms_due_at', 'sms_sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_notifications');
    }
};
