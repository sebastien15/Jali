<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Driver verification documents (story S1.2). Files live on the private
 * `local` disk and are only served through short-lived signed URLs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30);                       // licence_front|licence_back|national_id|selfie|insurance
            $table->string('path');
            $table->string('status', 20)->default('uploaded'); // uploaded|approved|rejected
            $table->string('rejection_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'type']);
        });

        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->timestamp('submitted_at')->nullable()->after('verification_status');
        });
    }

    public function down(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->dropColumn('submitted_at');
        });
        Schema::dropIfExists('driver_documents');
    }
};
