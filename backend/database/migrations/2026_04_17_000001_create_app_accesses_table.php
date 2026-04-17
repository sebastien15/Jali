<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('app_accesses', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 20); // 'ios', 'android', 'web'
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('accessed_at')->useCurrent();

            $table->index(['platform', 'accessed_at']);
            $table->index(['user_id', 'accessed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_accesses');
    }
};
