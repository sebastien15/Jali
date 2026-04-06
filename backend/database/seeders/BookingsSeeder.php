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

        $bookings = [
            // Bus bookings
            [
                'user_id' => $user1->id,
                'type' => 'bus',
                'reference_id' => 1,
                'title' => 'Volcano Express • Kigali → Musanze',
                'sub' => 'Departs 06:00 • 60 seats',
                'price' => 3000,
                'service_fee' => 500,
                'status' => 'confirmed',
                'ticket_photo_url' => 'https://firebasestorage.googleapis.com/v0/b/jali-8cad5.appspot.com/o/tickets%2Fticket_001.jpg',
                'payment_method' => 'MTN MoMo',
                'paid_at' => now()->subDays(5),
            ],
            [
                'user_id' => $user2->id,
                'type' => 'bus',
                'reference_id' => 2,
                'title' => 'RITCO • Kigali → Musanze',
                'sub' => 'Departs 07:00 • 50 seats',
                'price' => 2500,
                'service_fee' => 500,
                'status' => 'pending',
                'payment_method' => 'Airtel Money',
            ],
            [
                'user_id' => $user3->id,
                'type' => 'bus',
                'reference_id' => 9,
                'title' => 'RITCO • Kigali → Huye',
                'sub' => 'Departs 07:00 • 50 seats',
                'price' => 2500,
                'service_fee' => 400,
                'status' => 'completed',
                'ticket_photo_url' => 'https://firebasestorage.googleapis.com/v0/b/jali-8cad5.appspot.com/o/tickets%2Fticket_003.jpg',
                'payment_method' => 'MTN MoMo',
                'paid_at' => now()->subDays(10),
            ],
            [
                'user_id' => $user1->id,
                'type' => 'bus',
                'reference_id' => 14,
                'title' => 'RITCO • Kigali → Rubavu',
                'sub' => 'Departs 07:00 • 50 seats',
                'price' => 4000,
                'service_fee' => 500,
                'status' => 'confirmed',
                'ticket_photo_url' => 'https://firebasestorage.googleapis.com/v0/b/jali-8cad5.appspot.com/o/tickets%2Fticket_004.jpg',
                'payment_method' => 'Card',
                'paid_at' => now()->subDays(2),
            ],

            // Rental bookings
            [
                'user_id' => $user4->id,
                'type' => 'rental',
                'reference_id' => 1,
                'title' => 'Toyota RAV4 (SUV)',
                'sub' => 'RAD 123A • 5 seats',
                'price' => 100000,
                'service_fee' => 300,
                'status' => 'confirmed',
                'ticket_photo_url' => 'https://firebasestorage.googleapis.com/v0/b/jali-8cad5.appspot.com/o/tickets%2Fticket_005.jpg',
                'payment_method' => 'Card',
                'paid_at' => now()->subDays(3),
            ],
            [
                'user_id' => $user5->id,
                'type' => 'rental',
                'reference_id' => 4,
                'title' => 'Toyota Corolla (Sedan)',
                'sub' => 'RAD 111D • 5 seats',
                'price' => 70000,
                'service_fee' => 300,
                'status' => 'pending',
                'payment_method' => 'MTN MoMo',
            ],

            // Private bookings
            [
                'user_id' => $user2->id,
                'type' => 'private',
                'reference_id' => 1,
                'title' => 'Joseph Ndayisaba • Kigali → Musanze',
                'sub' => 'Departs 2025-04-10 06:00 • 3 seats',
                'price' => 2000,
                'service_fee' => 500,
                'status' => 'confirmed',
                'ticket_photo_url' => 'https://firebasestorage.googleapis.com/v0/b/jali-8cad5.appspot.com/o/tickets%2Fticket_007.jpg',
                'payment_method' => 'MTN MoMo',
                'paid_at' => now()->subDays(1),
            ],
            [
                'user_id' => $user3->id,
                'type' => 'private',
                'reference_id' => 2,
                'title' => 'Claudine Nyiramana • Kigali → Musanze',
                'sub' => 'Departs 2025-04-10 08:00 • 2 seats',
                'price' => 2000,
                'service_fee' => 500,
                'status' => 'pending',
                'payment_method' => 'Airtel Money',
            ],
        ];

        foreach ($bookings as $booking) {
            Booking::create($booking);
        }
    }
}
