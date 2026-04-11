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

        if ($request->has('from')) {
            $query->where('from', $request->from);
        }

        if ($request->has('to')) {
            $query->where('to', $request->to);
        }

        if ($request->has('date')) {
            $dateStr = $request->date;
            if (strtolower($dateStr) === 'today') {
                $dateStr = now()->format('Y-m-d');
            } elseif (strtolower($dateStr) === 'tomorrow') {
                $dateStr = now()->addDay()->format('Y-m-d');
            }
            $query->where(function ($q) use ($dateStr) {
                $q->whereDate('dep', $dateStr)->orWhere('date', $dateStr);
            });
        }

        return response()->json($query->orderBy('dep')->get());
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

        $listing->update($validated);

        return response()->json($listing->fresh());
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
