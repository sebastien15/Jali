<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('corridors', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique(); // e.g. CRD-01
            $table->string('name');               // e.g. North-West
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('corridors');
    }
};
