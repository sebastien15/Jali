<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add price/seats/duration/active to agency_routes
        Schema::table('agency_routes', function (Blueprint $table) {
            $table->unsignedInteger('price')->default(0)->after('corridor_id');
            $table->unsignedInteger('total_seats')->default(30)->after('price');
            $table->unsignedInteger('duration_mins')->default(0)->after('total_seats');
            $table->boolean('active')->default(true)->after('duration_mins');
        });

        // 2. Create trip_departures table
        Schema::create('trip_departures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_route_id')->constrained('agency_routes')->cascadeOnDelete();
            $table->time('departure_time');
            $table->boolean('active')->default(true);
            $table->unsignedBigInteger('_legacy_trip_id')->nullable();
            $table->timestamps();
            $table->index(['agency_route_id', 'departure_time']);
        });

        // 3. Migrate data from trips → agency_routes + trip_departures
        $trips = DB::table('trips')->orderBy('id')->get();

        foreach ($trips as $trip) {
            // Calculate duration from departure and estimated_arrival
            [$dh, $dm] = array_map('intval', explode(':', substr($trip->departure_time, 0, 5)));
            [$ah, $am] = array_map('intval', explode(':', substr($trip->estimated_arrival_time, 0, 5)));
            $duration = ($ah * 60 + $am) - ($dh * 60 + $dm);
            if ($duration < 0) $duration += 24 * 60;

            // Find existing agency_route for this trip
            $route = DB::table('agency_routes')
                ->where('agency_id', $trip->agency_id)
                ->where('from_station_id', $trip->from_station_id)
                ->where('to_station_id', $trip->to_station_id)
                ->first();

            if ($route) {
                // Only fill in price/seats/duration if not already set
                if ($route->price == 0) {
                    DB::table('agency_routes')->where('id', $route->id)->update([
                        'price'        => $trip->price,
                        'total_seats'  => $trip->total_seats,
                        'duration_mins' => $duration,
                        'active'       => $trip->active,
                        'updated_at'   => now(),
                    ]);
                }
                $routeId = $route->id;
            } else {
                $routeId = DB::table('agency_routes')->insertGetId([
                    'agency_id'       => $trip->agency_id,
                    'from_station_id' => $trip->from_station_id,
                    'to_station_id'   => $trip->to_station_id,
                    'corridor_id'     => null,
                    'price'           => $trip->price,
                    'total_seats'     => $trip->total_seats,
                    'duration_mins'   => $duration,
                    'active'          => $trip->active,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);
            }

            // Create departure
            DB::table('trip_departures')->insert([
                'agency_route_id' => $routeId,
                'departure_time'  => substr($trip->departure_time, 0, 5),
                'active'          => $trip->active,
                '_legacy_trip_id' => $trip->id,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);
        }

        // 4. Add trip_departure_id to bookings
        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedBigInteger('trip_departure_id')->nullable()->after('trip_id');
        });

        // 5. Backfill trip_departure_id on existing bookings
        $departures = DB::table('trip_departures')
            ->whereNotNull('_legacy_trip_id')
            ->pluck('id', '_legacy_trip_id');

        foreach ($departures as $oldTripId => $departureId) {
            DB::table('bookings')
                ->where('trip_id', $oldTripId)
                ->update(['trip_departure_id' => $departureId]);
        }

        // 6. Drop temp column
        Schema::table('trip_departures', function (Blueprint $table) {
            $table->dropColumn('_legacy_trip_id');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('trip_departure_id');
        });
        Schema::dropIfExists('trip_departures');
        Schema::table('agency_routes', function (Blueprint $table) {
            $table->dropColumn(['price', 'total_seats', 'duration_mins', 'active']);
        });
    }
};
