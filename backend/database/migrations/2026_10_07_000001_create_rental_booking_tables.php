<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Car rental launch (epic E24, Batch 1): full car listings with photos, owner
 * rules and documents, verification, date-range reservations, blocked dates,
 * handover/return records and ratings. Owned by Modules/Rentals.
 */
return new class extends Migration
{
    private const CAR_COLUMNS = [
        'make', 'model', 'year', 'color', 'transmission', 'fuel_type', 'doors', 'luggage', 'description', 'city',
        'pickup_address', 'pickup_lat', 'pickup_lng', 'delivery_available', 'delivery_fee',
        'mileage_limit_km', 'extra_km_fee', 'fuel_policy', 'min_driver_age', 'min_licence_years',
        'min_days', 'max_days', 'notice_hours', 'weekly_discount_pct', 'monthly_discount_pct',
        'cancellation_policy', 'allowed', 'rules', 'documents', 'insurance_expiry',
        'verification_status', 'verification_note', 'verified_at', 'trips_count',
    ];

    public function up(): void
    {
        if (!Schema::hasColumn('car_rentals', 'verification_status')) {
            Schema::table('car_rentals', function (Blueprint $table) {
                $table->string('make', 60)->nullable();
                $table->string('model', 60)->nullable();
                $table->unsignedSmallInteger('year')->nullable();
                $table->string('color', 30)->nullable();
                $table->string('transmission', 20)->nullable();          // automatic|manual
                $table->string('fuel_type', 20)->nullable();             // petrol|diesel|hybrid|electric
                $table->unsignedTinyInteger('doors')->nullable();
                $table->unsignedTinyInteger('luggage')->nullable();       // large bags
                $table->text('description')->nullable();
                $table->string('city', 60)->nullable();
                $table->string('pickup_address')->nullable();
                $table->decimal('pickup_lat', 10, 7)->nullable();
                $table->decimal('pickup_lng', 10, 7)->nullable();
                $table->boolean('delivery_available')->default(false);
                $table->unsignedInteger('delivery_fee')->default(0);
                $table->unsignedInteger('mileage_limit_km')->nullable();  // per day; null = unlimited
                $table->unsignedInteger('extra_km_fee')->default(0);
                $table->string('fuel_policy', 20)->default('same_to_same');
                $table->unsignedTinyInteger('min_driver_age')->default(21);
                $table->unsignedTinyInteger('min_licence_years')->default(1);
                $table->unsignedSmallInteger('min_days')->default(1);
                $table->unsignedSmallInteger('max_days')->nullable();
                $table->unsignedSmallInteger('notice_hours')->default(12);
                $table->unsignedTinyInteger('weekly_discount_pct')->default(0);
                $table->unsignedTinyInteger('monthly_discount_pct')->default(0);
                $table->string('cancellation_policy', 20)->default('moderate');
                $table->json('allowed')->nullable();                      // smoking, pets, outside_kigali, cross_border
                $table->json('rules')->nullable();                        // owner's own rules, list of strings
                $table->json('documents')->nullable();                    // private paths: registration, insurance
                $table->date('insurance_expiry')->nullable();
                // Cars added before this release (admin-seeded) stay visible: default verified,
                // new owner listings are created as pending by OwnerFleet.
                $table->string('verification_status', 20)->default('verified');
                $table->string('verification_note', 500)->nullable();
                $table->dateTime('verified_at')->nullable();
                $table->unsignedInteger('trips_count')->default(0);
            });
        }

        if (!Schema::hasTable('rental_blocks')) Schema::create('rental_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_rental_id')->constrained()->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');                                     // inclusive
            $table->string('reason', 120)->nullable();
            $table->timestamps();
            $table->index(['car_rental_id', 'start_date']);
        });

        if (!Schema::hasTable('rental_bookings')) Schema::create('rental_bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_rental_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('requested');
            // dateTime, not timestamp: production MySQL rejects extra NOT NULL timestamps
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->unsignedSmallInteger('days');
            $table->string('pickup_method', 10)->default('pickup');      // pickup|delivery
            $table->string('delivery_address')->nullable();
            $table->string('note', 500)->nullable();
            $table->string('payment_method', 10)->default('cash');       // cash|momo, paid to the owner
            $table->json('quote');                                        // price lock
            $table->json('terms');                                        // rules and policies at booking time
            $table->unsignedInteger('total');
            $table->unsignedInteger('deposit')->default(0);
            $table->unsignedInteger('final_total')->nullable();
            $table->json('extra_charges')->nullable();
            $table->unsignedInteger('cancel_fee')->default(0);
            $table->string('cancel_reason', 300)->nullable();
            $table->string('cancelled_by', 10)->nullable();               // customer|owner
            $table->string('decline_reason', 300)->nullable();
            $table->json('handover')->nullable();                         // odometer, fuel, photos, notes
            $table->json('return_record')->nullable();
            $table->dateTime('requested_at');
            $table->dateTime('expires_at')->nullable();
            $table->dateTime('accepted_at')->nullable();
            $table->dateTime('handed_over_at')->nullable();
            $table->dateTime('returned_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->timestamps();
            $table->index(['car_rental_id', 'status', 'start_at']);
            $table->index(['customer_id', 'status']);
            $table->index(['owner_id', 'status']);
        });

        if (!Schema::hasTable('rental_ratings')) Schema::create('rental_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rental_booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('stars');
            $table->string('comment', 500)->nullable();
            $table->timestamps();
            $table->unique(['rental_booking_id', 'from_user_id']);
        });

        $this->grant('offer-rentals', 'List cars for rent and manage rental requests', ['superadmin', 'driver']);
        $this->grant('rent-cars', 'Rent cars from owners', ['superadmin', 'admin', 'user', 'driver']);
        $this->grant('manage-rentals', 'Verify rental cars and handle rental problems', ['superadmin', 'admin']);
    }

    private function grant(string $name, string $description, array $roles): void
    {
        DB::table('permissions')->updateOrInsert(
            ['name' => $name],
            ['description' => $description, 'category' => 'Rentals', 'created_at' => now(), 'updated_at' => now()]
        );
        $permissionId = DB::table('permissions')->where('name', $name)->value('id');
        foreach (DB::table('roles')->whereIn('name', $roles)->pluck('id') as $roleId) {
            DB::table('role_permissions')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_ratings');
        Schema::dropIfExists('rental_bookings');
        Schema::dropIfExists('rental_blocks');
        Schema::table('car_rentals', function (Blueprint $table) {
            $table->dropColumn(self::CAR_COLUMNS);
        });
        DB::table('permissions')->whereIn('name', ['offer-rentals', 'rent-cars', 'manage-rentals'])->delete();
    }
};
