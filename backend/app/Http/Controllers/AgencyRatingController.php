<?php

namespace App\Http\Controllers;

use App\Modules\Bus\Application\AgencyRatings;
use Illuminate\Http\Request;

/** Transport adapter for Bus (runbook M03-Bus): validation + HTTP shape only. */
class AgencyRatingController extends Controller
{
    public function __construct(private readonly AgencyRatings $ratings)
    {
    }

    /**
     * Rate an agency (upsert — one rating per user per agency).
     */
    public function store(Request $request, $agencyId)
    {
        // 404 for an unknown agency wins over validation, as before.
        $agency = $this->ratings->findAgency($agencyId);

        $validated = $request->validate([
            'stars'   => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:500',
        ]);

        // Only passengers who actually booked this agency may rate it.
        $result = $this->ratings->rate($agency, $request->user(), $validated['stars'], $validated['comment'] ?? null);
        if ($result === null) {
            return response()->json(['message' => 'You can rate an agency after booking a trip with it.'], 403);
        }

        return response()->json($result);
    }
}
