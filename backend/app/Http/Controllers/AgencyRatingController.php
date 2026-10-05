<?php

namespace App\Http\Controllers;

use App\Models\Agency;
use App\Models\AgencyRating;
use App\Models\Booking;
use Illuminate\Http\Request;

class AgencyRatingController extends Controller
{
    /**
     * Rate an agency (upsert — one rating per user per agency).
     */
    public function store(Request $request, $agencyId)
    {
        $agency = Agency::findOrFail($agencyId);

        $validated = $request->validate([
            'stars'   => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:500',
        ]);

        // Only passengers who actually booked this agency may rate it.
        $hasBooked = Booking::where('user_id', $request->user()->id)
            ->where('type', 'trip')
            ->where('status', '!=', 'cancelled')
            ->whereHas('departure.route', fn ($q) => $q->where('agency_id', $agency->id))
            ->exists();
        if (!$hasBooked) {
            return response()->json(['message' => 'You can rate an agency after booking a trip with it.'], 403);
        }

        $rating = AgencyRating::updateOrCreate(
            [
                'agency_id' => $agencyId,
                'user_id'   => $request->user()->id,
            ],
            [
                'stars'   => $validated['stars'],
                'comment' => $validated['comment'] ?? null,
            ]
        );

        return response()->json([
            'average_rating' => $agency->average_rating,
            'ratings_count'  => $agency->ratings->count(),
            'your_rating'    => $rating->stars,
        ]);
    }
}
