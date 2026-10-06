<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** S16.3: support tickets linked to a ride/hire/rental, with SLA, assignment and canned replies. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('subject_type', 10)->nullable();        // ride | hire | rental
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('category', 20);
            $table->string('priority', 10)->default('normal');      // urgent | high | normal
            $table->string('status', 10)->default('open');          // open | answered | resolved
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('first_response_due_at');
            $table->dateTime('first_responded_at')->nullable();
            $table->dateTime('last_message_at');
            $table->dateTime('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'priority', 'first_response_due_at']);
            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_staff')->default(false);
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('support_canned_replies', function (Blueprint $table) {
            $table->id();
            $table->string('title', 80);
            $table->text('body');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('support_canned_replies');
    }
};
