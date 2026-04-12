<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Database\Seeder;

class BookingsSeeder extends Seeder
{
    public function run(): void
    {
        // Get some users
        $user1 = User::where('firebase_uid', 'user_001_uid')->first();
        $user2 = User::where('firebase_uid', 'user_002_uid')->first();
        $user3 = User::where('firebase_uid', 'user_003_uid')->first();
        $user4 = User::where('firebase_uid', 'user_004_uid')->first();
        $user5 = User::where('firebase_uid', 'user_005_uid')->first();

        if (!$user1 || !$user2 || !$user3) return;

        // Booking lifecycle: pending → taken → ticket_ready → delivered
        $bookings = [
            // Trip bookings (using real trip IDs from AgenciesTripsSeeder)
            [
                'user_id'        => $user1->id,
                'type'           => 'trip',
                'reference_id'   => 1,
                'title'          => 'Trinity • Kigali → Musanze',
                'sub'            => 'Departs 05:00',
                'price'          => 4000,
                'service_fee'    => 500,
                'status'         => 'pending',
                'payment_method' => 'MTN MoMo',
            ],
            [
                'user_id'        => $user2->id,
                'type'           => 'trip',
                'reference_id'   => 2,
                'title'          => 'Trinity • Kigali → Musanze',
                'sub'            => 'Departs 06:00',
                'price'          => 4000,
                'service_fee'    => 500,
                'status'         => 'pending',
                'payment_method' => 'Airtel Money',
            ],
            [
                'user_id'        => $user3->id,
                'type'           => 'trip',
                'reference_id'   => 3,
                'title'          => 'Trinity • Kigali → Musanze',
                'sub'            => 'Departs 07:00',
                'price'          => 4000,
                'service_fee'    => 500,
                'status'         => 'taken',
                'payment_method' => 'MTN MoMo',
            ],
            [
                'user_id'        => $user1->id,
                'type'           => 'trip',
                'reference_id'   => 17,
                'title'          => 'Trinity • Kigali → Huye',
                'sub'            => 'Departs 05:00',
                'price'          => 4000,
                'service_fee'    => 500,
                'status'         => 'ticket_ready',
                'payment_method' => 'Card',
                'paid_at'        => now()->subDays(2),
            ],
            [
                'user_id'        => $user4->id,
                'type'           => 'trip',
                'reference_id'   => 18,
                'title'          => 'Trinity • Kigali → Huye',
                'sub'            => 'Departs 06:00',
                'price'          => 4000,
                'service_fee'    => 500,
                'status'         => 'delivered',
                'payment_method' => 'MTN MoMo',
                'paid_at'        => now()->subDays(5),
            ],
            [
                'user_id'        => $user5->id,
                'type'           => 'trip',
                'reference_id'   => 19,
                'title'          => 'Trinity • Kigali → Huye',
                'sub'            => 'Departs 07:00',
                'price'          => 4000,
                'service_fee'    => 500,
                'status'         => 'delivered',
                'payment_method' => 'Card',
                'paid_at'        => now()->subDays(3),
            ],

            // Rental bookings
            [
                'user_id'        => $user2->id,
                'type'           => 'rental',
                'reference_id'   => 1,
                'title'          => 'Toyota RAV4 (SUV)',
                'sub'            => 'RAD 123A • 5 seats',
                'price'          => 100000,
                'service_fee'    => 3000,
                'status'         => 'pending',
                'payment_method' => 'Card',
            ],
            [
                'user_id'        => $user3->id,
                'type'           => 'rental',
                'reference_id'   => 2,
                'title'          => 'Toyota Corolla (Sedan)',
                'sub'            => 'RAD 111D • 5 seats',
                'price'          => 70000,
                'service_fee'    => 3000,
                'status'         => 'delivered',
                'payment_method' => 'MTN MoMo',
                'paid_at'        => now()->subDays(7),
            ],

            // Private bookings
            [
                'user_id'        => $user1->id,
                'type'           => 'private',
                'reference_id'   => 1,
                'title'          => 'Joseph Ndayisaba • Kigali → Musanze',
                'sub'            => 'Departs 06:00 • 3 seats',
                'price'          => 2000,
                'service_fee'    => 500,
                'status'         => 'taken',
                'payment_method' => 'MTN MoMo',
            ],
            [
                'user_id'        => $user4->id,
                'type'           => 'private',
                'reference_id'   => 2,
                'title'          => 'Claudine Nyiramana • Kigali → Musanze',
                'sub'            => 'Departs 08:00 • 2 seats',
                'price'          => 2000,
                'service_fee'    => 500,
                'status'         => 'pending',
                'payment_method' => 'Airtel Money',
            ],
        ];

        foreach ($bookings as $booking) {
            Booking::create($booking);
        }
    }
}
