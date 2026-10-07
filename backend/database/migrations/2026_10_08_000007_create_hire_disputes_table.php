<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** S6.5: either side of a finished hire can dispute the recorded hours; admins resolve. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hire_disputes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_hire_id')->constrained('driver_hires')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 10);                      // customer | driver
            $table->string('reason', 1000);
            $table->string('claimed_end', 40)->nullable();   // what they say the real end time was (free text, e.g. "17:30")
            $table->string('status', 10)->default('open');   // open | resolved
            $table->string('resolution', 1000)->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hire_disputes');
    }
};
