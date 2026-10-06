<?php

namespace Tests\Feature\Rentals;

use App\Models\CarRental;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

trait RentalTestHelpers
{
    protected User $owner;
    protected User $customer;
    protected User $admin;

    protected function setUpRentals(): void
    {
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        Storage::fake('public');
        Storage::fake('local');
        $this->seed(RolesAndPermissionsSeeder::class);
        // Monday 12 Oct 2026, 08:00 in Kigali
        $this->travelTo(Carbon::parse('2026-10-12 08:00', 'Africa/Kigali')->utc());
        $this->owner = $this->person('Eric Habimana', '+250788200200', 'driver');
        $this->customer = $this->person('Grace Uwase', '+250788100100', 'user');
        $this->admin = $this->person('Ops Admin', null, 'admin');
    }

    protected function person(string $name, ?string $phone, string $role): User
    {
        return User::create(['name' => $name, 'phone' => $phone, 'email' => $phone ? null : strtolower(str_replace(' ', '.', $name)) . '@jali.rw',
            'fcm_token' => 'ExponentPushToken[' . md5($name) . ']', 'role_id' => Role::where('name', $role)->value('id')]);
    }

    protected function carPayload(array $overrides = []): array
    {
        return array_merge([
            'make' => 'Toyota', 'model' => 'RAV4', 'year' => 2019, 'color' => 'Silver', 'type' => 'SUV',
            'plate' => 'rad 123 b', 'seats' => 5, 'doors' => 5, 'luggage' => 3, 'priceDay' => 50000, 'caution' => 200000,
            'transmission' => 'automatic', 'fuel_type' => 'petrol',
            'description' => 'Clean, well serviced RAV4. Great for upcountry trips and Akagera.',
            'city' => 'Kigali', 'pickup_address' => 'KG 9 Ave, Nyarutarama', 'pickup_lat' => -1.9441, 'pickup_lng' => 30.1012,
            'delivery_available' => true, 'delivery_fee' => 10000,
            'mileage_limit_km' => 200, 'extra_km_fee' => 300, 'fuel_policy' => 'same_to_same',
            'min_driver_age' => 23, 'min_licence_years' => 2, 'min_days' => 1, 'max_days' => 30, 'notice_hours' => 12,
            'weekly_discount_pct' => 10, 'monthly_discount_pct' => 20, 'cancellation_policy' => 'moderate',
            'allowed' => ['smoking' => false, 'pets' => true, 'outside_kigali' => true, 'cross_border' => false],
            'rules' => ['Return the car washed', 'No off-road driving in the rainy season'],
            'amenities' => ['AC', 'Bluetooth'], 'insurance_expiry' => '2027-06-30',
        ], $overrides);
    }

    /** A complete, admin-verified car of $this->owner */
    protected function verifiedCar(array $overrides = []): CarRental
    {
        $car = CarRental::create(array_merge([
            'user_id' => $this->owner->id, 'name' => 'Toyota RAV4', 'make' => 'Toyota', 'model' => 'RAV4', 'type' => 'SUV',
            'plate' => 'RAD 123 B', 'seats' => 5, 'price' => 50000, 'caution' => 200000, 'rating' => 0, 'active' => true,
            'status' => 'available', 'transmission' => 'automatic', 'fuel_type' => 'petrol', 'description' => 'Clean RAV4',
            'city' => 'Kigali', 'pickup_address' => 'KG 9 Ave, Nyarutarama', 'pickup_lat' => -1.9441, 'pickup_lng' => 30.1012,
            'delivery_available' => true, 'delivery_fee' => 10000, 'mileage_limit_km' => 200, 'extra_km_fee' => 300,
            'min_days' => 1, 'max_days' => 30, 'notice_hours' => 12, 'weekly_discount_pct' => 10, 'monthly_discount_pct' => 20,
            'cancellation_policy' => 'moderate', 'rules' => ['Return the car washed'], 'allowed' => ['pets' => true],
            'photos' => ['/storage/a.jpg', '/storage/b.jpg', '/storage/c.jpg'],
            'documents' => ['registration' => 'rental-documents/x/reg.pdf', 'insurance' => 'rental-documents/x/ins.pdf'],
            'verification_status' => CarRental::VERIFIED, 'verified_at' => now(),
        ], $overrides));

        return $car;
    }

    protected function image(string $name = 'car.jpg'): UploadedFile
    {
        return UploadedFile::fake()->image($name, 800, 600);
    }

    /** Kigali local time as ISO string */
    protected function kigali(string $local): string
    {
        return Carbon::parse($local, 'Africa/Kigali')->toIso8601String();
    }
}
