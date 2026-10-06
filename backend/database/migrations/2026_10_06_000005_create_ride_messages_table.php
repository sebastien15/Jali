<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Story S9.5 — rider ↔ driver chat with quick phrases */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ride_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ride_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->string('phrase', 40)->nullable();   // quick phrase key, shown in each side's language
            $table->string('body', 300)->nullable();    // free text, delivered as written
            $table->timestamp('created_at')->nullable();

            $table->index(['ride_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ride_messages');
    }
};
