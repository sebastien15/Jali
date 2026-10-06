<?php

namespace App\Http\Controllers;

use App\Modules\SharedJourneys\Application\InvalidListingDate;
use App\Modules\SharedJourneys\Application\OwnerListings;
use App\Modules\SharedJourneys\Application\SeatCatalogue;
use Illuminate\Http\Request;

/** Transport adapter for SharedJourneys (runbook M03-Shared): validation + HTTP shape only. */
class PrivateSeatController extends Controller
{
    public function __construct(
        private readonly SeatCatalogue $catalogue,
        private readonly OwnerListings $listings,
    ) {
    }

    /**
     * GET /private-seats
     * Public catalog — active listings with available seats.
     */
    public function index(Request $request)
    {
        return response()->json($this->catalogue->search(
            $request->filled('from') ? $request->from : null,
            $request->filled('to') ? $request->to : null,
            $request->filled('date') ? $request->date : null,
        ));
    }

    /**
     * GET /driver/listings
     * Driver's own listings only.
     */
    public function driverListings(Request $request)
    {
        return response()->json($this->listings->listingsOf($request->user()));
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

        try {
            $listing = $this->listings->create($request->user(), $validated);
        } catch (InvalidListingDate) {
            return self::invalidDate();
        }

        return response()->json($listing, 201);
    }

    /**
     * PATCH /driver/listings/{id}
     */
    public function update(Request $request, $id)
    {
        // Ownership is checked before validation (404 wins over 422), as before.
        $listing = $this->listings->findOwned($request->user(), $id);

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

        try {
            return response()->json($this->listings->update($listing, $validated));
        } catch (InvalidListingDate) {
            return self::invalidDate();
        }
    }

    /**
     * DELETE /driver/listings/{id}
     */
    public function destroy(Request $request, $id)
    {
        $this->listings->delete($this->listings->findOwned($request->user(), $id));

        return response()->json(null, 204);
    }

    private static function invalidDate()
    {
        return response()->json(['message' => 'Invalid date.', 'errors' => ['date' => ['Invalid date.']]], 422);
    }
}
