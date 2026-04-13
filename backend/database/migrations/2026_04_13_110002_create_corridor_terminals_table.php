<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('corridor_terminals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('corridor_id')
                ->constrained('corridors')
                ->cascadeOnDelete();
            $table->foreignId('terminal_id')
                ->constrained('admin_stations')
                ->cascadeOnDelete();
            $table->unsignedSmallInteger('stop_order');
            $table->timestamps();

            $table->unique(['corridor_id', 'terminal_id']);
            $table->unique(['corridor_id', 'stop_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('corridor_terminals');
    }
};
