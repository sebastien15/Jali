<?php

namespace App\Http\Controllers;

use App\Models\PrivateSeat;
use Illuminate\Http\Request;

class PrivateSeatController extends Controller
{
    /**
     * GET /private-seats
     * Public catalog — active listings with available seats.
     */
    public function index(Request $request)
    {
        $query = PrivateSeat::query()->where('seats', '>', 0)->where('active', true);

        if ($request->filled('from')) {
            $query->where('from', $request->from);
        }

        if ($request->filled('to')) {
            $query->where('to', $request->to);
        }

        if ($request->filled('date') && ($date = self::normalizeDate($request->date))) {
            // Listings without a date run every day.
            $query->where(fn ($q) => $q->whereNull('date')->orWhere('date', $date));
        }

        return response()->json($query->orderBy('dep')->paginate(10));
    }

    /**
     * GET /driver/listings
     * Driver's own listings only.
     */
    public function driverListings(Request $request)
    {
        $listings = PrivateSeat::where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json($listings);
    }

    /**
     * POST /driver/listings
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'from'                => 'required|string',
            'to'                  => 'required|string',
            'pickup_station'      => 'required|string',
            'drop_location'       => 'nullable|string',
            'dep'                 => 'required|string',
            'date'                => 'nullable|string',
            'price'               => 'required|integer|min:0',
            'seats'               => 'required|integer|min:1',
            'notes'               => 'nullable|string',
            'amenities'           => 'nullable|array',
            'group_discount'      => 'boolean',
            'group_min_size'      => 'integer|min:2',
            'group_discount_pct'  => 'integer|min:1|max:100',
            'allow_custom_pickup' => 'boolean',
            'custom_pickup_fee'   => 'integer|min:0',
        ]);

        if (array_key_exists('date', $validated) && ($validated['date'] = self::normalizeDate($validated['date'])) === false) {
            return response()->json(['message' => 'Invalid date.', 'errors' => ['date' => ['Invalid date.']]], 422);
        }

        $validated['user_id'] = $request->user()->id;
        $validated['driver']  = $request->user()->name;
        $validated['active']  = true;

        $listing = PrivateSeat::create($validated);

        return response()->json($listing, 201);
    }

    /**
     * PATCH /driver/listings/{id}
     */
    public function update(Request $request, $id)
    {
        $listing = PrivateSeat::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $validated = $request->validate([
            'from'                => 'sometimes|string',
            'to'                  => 'sometimes|string',
            'pickup_station'      => 'sometimes|string',
            'drop_location'       => 'nullable|string',
            'dep'                 => 'sometimes|string',
            'date'                => 'nullable|string',
            'price'               => 'sometimes|integer|min:0',
            'seats'               => 'sometimes|integer|min:1',
            'notes'               => 'nullable|string',
            'active'              => 'boolean',
            'amenities'           => 'nullable|array',
            'group_discount'      => 'boolean',
            'group_min_size'      => 'integer|min:2',
            'group_discount_pct'  => 'integer|min:1|max:100',
            'allow_custom_pickup' => 'boolean',
            'custom_pickup_fee'   => 'integer|min:0',
        ]);

        if (array_key_exists('date', $validated) && ($validated['date'] = self::normalizeDate($validated['date'])) === false) {
            return response()->json(['message' => 'Invalid date.', 'errors' => ['date' => ['Invalid date.']]], 422);
        }

        $listing->update($validated);

        return response()->json($listing->fresh());
    }

    /**
     * Listing dates arrive as "Today", "Mon 5 Oct 2026", "2026-10-05"…
     * Store/compare them as Y-m-d (Africa/Kigali). null = no date, false = invalid.
     */
    public static function normalizeDate(?string $raw): string|null|false
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }
        $tz = 'Africa/Kigali';
        try {
            return match (strtolower(trim($raw))) {
                'today'    => now($tz)->toDateString(),
                'tomorrow' => now($tz)->addDay()->toDateString(),
                default    => \Illuminate\Support\Carbon::parse($raw, $tz)->toDateString(),
            };
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * DELETE /driver/listings/{id}
     */
    public function destroy(Request $request, $id)
    {
        $listing = PrivateSeat::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $listing->delete();

        return response()->json(null, 204);
    }
}
