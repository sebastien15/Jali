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
        // phone and profile_image_url already exist on users table
        Schema::table("users", function (Blueprint $table) {
            $table->string("whatsapp_number")->nullable()->after("phone");
            $table
                ->string("contract_doc_url")
                ->nullable()
                ->after("whatsapp_number");
            $table
                ->boolean("contract_verified")
                ->default(false)
                ->after("contract_doc_url");
        });
    }

    public function down(): void
    {
        Schema::table("users", function (Blueprint $table) {
            $table->dropColumn([
                "whatsapp_number",
                "contract_doc_url",
                "contract_verified",
            ]);
        });
    }
};
