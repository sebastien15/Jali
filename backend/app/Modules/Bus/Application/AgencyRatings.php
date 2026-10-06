<?php

namespace App\Modules\Bus\Application;

use App\Models\Agency;
use App\Models\AgencyRating;
use App\Models\Booking;
use App\Models\User;

/** Passenger ratings of bus agencies: one rating per user per agency (upsert). */
class AgencyRatings
{
    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException */
    public function findAgency(int|string $agencyId): Agency
    {
        return Agency::findOrFail($agencyId);
    }

    /**
     * Only passengers with a non-cancelled trip booking on one of the agency's
     * departures may rate it.
     *
     * @return array|null the response payload, or null when the user may not rate
     */
    public function rate(Agency $agency, User $user, mixed $stars, ?string $comment): ?array
    {
        $hasBooked = Booking::where('user_id', $user->id)
            ->where('type', 'trip')
            ->where('status', '!=', 'cancelled')
            ->whereHas('departure.route', fn ($q) => $q->where('agency_id', $agency->id))
            ->exists();
        if (!$hasBooked) {
            return null;
        }

        $rating = AgencyRating::updateOrCreate(
            [
                'agency_id' => $agency->id,
                'user_id'   => $user->id,
            ],
            [
                'stars'   => $stars,
                'comment' => $comment,
            ]
        );

        return [
            'average_rating' => $agency->average_rating,
            'ratings_count'  => $agency->ratings->count(),
            'your_rating'    => $rating->stars,
        ];
    }
}
