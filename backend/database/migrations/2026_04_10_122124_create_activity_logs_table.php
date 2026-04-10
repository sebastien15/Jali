<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create("activity_logs", function (Blueprint $table) {
            $table->id();
            $table
                ->foreignId("admin_id")
                ->constrained("users")
                ->onDelete("cascade");
            $table->string("action");
            $table->string("entity_type");
            $table->unsignedBigInteger("entity_id");
            $table->json("details")->nullable();
            $table->timestamps();

            $table->index(["admin_id", "created_at"]);
            $table->index(["entity_type", "entity_id"]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists("activity_logs");
    }
};
