<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class BookingsSeeder extends Seeder
{
    public function run(): void
    {
        $user1 = User::where('firebase_uid', 'user_001_uid')->first();
        $user2 = User::where('firebase_uid', 'user_002_uid')->first();
        $user3 = User::where('firebase_uid', 'user_003_uid')->first();
        $user4 = User::where('firebase_uid', 'user_004_uid')->first();
        $user5 = User::where('firebase_uid', 'user_005_uid')->first();

        if (!$user1 || !$user2 || !$user3) return;

        // Find real trips to reference (dynamic — IDs change on each reseed)
        $ritcoTrips = DB::table('trip_departures')
            ->join('agency_routes', 'trip_departures.agency_route_id', '=', 'agency_routes.id')
            ->join('agencies', 'agency_routes.agency_id', '=', 'agencies.id')
            ->join('admin_stations as from_s', 'agency_routes.from_station_id', '=', 'from_s.id')
            ->join('admin_stations as to_s', 'agency_routes.to_station_id', '=', 'to_s.id')
            ->where('agencies.name', 'RITCO Ltd')
            ->where('from_s.name', 'Nyabugogo Bus Park')
            ->select('trip_departures.id', 'trip_departures.departure_time', 'agency_routes.price', 'to_s.city as to_city')
            ->whereIn('to_s.city', ['Musanze', 'Huye'])
            ->get();

        $toMusanze  = $ritcoTrips->where('to_city', 'Musanze')->values();
        $toHuye     = $ritcoTrips->where('to_city', 'Huye')->values();
        $toRwamagana = DB::table('trip_departures')
            ->join('agency_routes', 'trip_departures.agency_route_id', '=', 'agency_routes.id')
            ->join('agencies', 'agency_routes.agency_id', '=', 'agencies.id')
            ->join('admin_stations as from_s', 'agency_routes.from_station_id', '=', 'from_s.id')
            ->join('admin_stations as to_s', 'agency_routes.to_station_id', '=', 'to_s.id')
            ->where('agencies.name', 'RITCO Ltd')
            ->where('from_s.name', 'Nyabugogo Bus Park')
            ->where('to_s.city', 'Rwamagana')
            ->select('trip_departures.id', 'trip_departures.departure_time', 'agency_routes.price')
            ->limit(5)
            ->get();

        $bookings = [];

        // Trip bookings — Nyabugogo → Musanze
        if ($toMusanze->count() >= 3) {
            $bookings[] = [
                'user_id'        => $user1->id,
                'trip_departure_id' => $toMusanze[0]->id,
                'type'           => 'trip',
                'reference_id'   => $toMusanze[0]->id,
                'title'          => 'RITCO • Kigali → Musanze',
                'sub'            => 'Departs ' . substr($toMusanze[0]->departure_time, 0, 5),
                'price'          => $toMusanze[0]->price,
                'service_fee'    => 500,
                'status'         => 'pending',
                'payment_method' => 'MTN MoMo',
            ];
            $bookings[] = [
                'user_id'        => $user2->id,
                'trip_departure_id' => $toMusanze[1]->id,
                'type'           => 'trip',
                'reference_id'   => $toMusanze[1]->id,
                'title'          => 'RITCO • Kigali → Musanze',
                'sub'            => 'Departs ' . substr($toMusanze[1]->departure_time, 0, 5),
                'price'          => $toMusanze[1]->price,
                'service_fee'    => 500,
                'status'         => 'pending',
                'payment_method' => 'Airtel Money',
            ];
            $bookings[] = [
                'user_id'        => $user3->id,
                'trip_departure_id' => $toMusanze[2]->id,
                'type'           => 'trip',
                'reference_id'   => $toMusanze[2]->id,
                'title'          => 'RITCO • Kigali → Musanze',
                'sub'            => 'Departs ' . substr($toMusanze[2]->departure_time, 0, 5),
                'price'          => $toMusanze[2]->price,
                'service_fee'    => 500,
                'status'         => 'taken',
                'payment_method' => 'MTN MoMo',
            ];
        }

        // Trip bookings — Nyabugogo → Huye
        if ($toHuye->count() >= 3 && $user4 && $user5) {
            $bookings[] = [
                'user_id'        => $user1->id,
                'trip_departure_id' => $toHuye[0]->id,
                'type'           => 'trip',
                'reference_id'   => $toHuye[0]->id,
                'title'          => 'RITCO • Kigali → Huye',
                'sub'            => 'Departs ' . substr($toHuye[0]->departure_time, 0, 5),
                'price'          => $toHuye[0]->price,
                'service_fee'    => 500,
                'status'         => 'ticket_ready',
                'payment_method' => 'Card',
                'paid_at'        => now()->subDays(2),
            ];
            $bookings[] = [
                'user_id'        => $user4->id,
                'trip_departure_id' => $toHuye[1]->id,
                'type'           => 'trip',
                'reference_id'   => $toHuye[1]->id,
                'title'          => 'RITCO • Kigali → Huye',
                'sub'            => 'Departs ' . substr($toHuye[1]->departure_time, 0, 5),
                'price'          => $toHuye[1]->price,
                'service_fee'    => 500,
                'status'         => 'delivered',
                'payment_method' => 'MTN MoMo',
                'paid_at'        => now()->subDays(5),
            ];
            $bookings[] = [
                'user_id'        => $user5->id,
                'trip_departure_id' => $toHuye[2]->id,
                'type'           => 'trip',
                'reference_id'   => $toHuye[2]->id,
                'title'          => 'RITCO • Kigali → Huye',
                'sub'            => 'Departs ' . substr($toHuye[2]->departure_time, 0, 5),
                'price'          => $toHuye[2]->price,
                'service_fee'    => 500,
                'status'         => 'delivered',
                'payment_method' => 'Card',
                'paid_at'        => now()->subDays(3),
            ];
        }

        // Rental bookings
        $bookings[] = [
            'user_id'        => $user2->id,
            'type'           => 'rental',
            'reference_id'   => 1,
            'title'          => 'Toyota RAV4 (SUV)',
            'sub'            => 'RAD 123A • 5 seats',
            'price'          => 100000,
            'service_fee'    => 3000,
            'status'         => 'pending',
            'payment_method' => 'Card',
        ];
        $bookings[] = [
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
        ];

        // Private seat bookings
        $bookings[] = [
            'user_id'        => $user1->id,
            'type'           => 'private',
            'reference_id'   => 1,
            'title'          => 'Joseph Ndayisaba • Kigali → Musanze',
            'sub'            => 'Departs 06:00 • 3 seats',
            'price'          => 2000,
            'service_fee'    => 500,
            'status'         => 'taken',
            'payment_method' => 'MTN MoMo',
        ];
        $bookings[] = [
            'user_id'        => $user4 ? $user4->id : $user2->id,
            'type'           => 'private',
            'reference_id'   => 2,
            'title'          => 'Claudine Nyiramana • Kigali → Musanze',
            'sub'            => 'Departs 08:00 • 2 seats',
            'price'          => 2000,
            'service_fee'    => 500,
            'status'         => 'pending',
            'payment_method' => 'Airtel Money',
        ];

        foreach ($bookings as $booking) {
            Booking::create($booking);
        }

        $this->command->info('BookingsSeeder: ' . count($bookings) . ' bookings created.');
    }
}
