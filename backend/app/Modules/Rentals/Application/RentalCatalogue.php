<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/** Rental catalogue: the legacy list (GET /car-rentals) and date search (GET /rentals/cars, S24.1). */
class RentalCatalogue
{
    /**
     * Active, verified cars their owner marks available, cheapest first.
     *
     * @param mixed $type the raw `type` filter, or null when the request did not fill it
     */
    public function available(mixed $type = null): Collection
    {
        // Cars marked rented / in maintenance by their owner, and unverified listings, are not offered.
        $query = CarRental::query()->where('active', true)->where('status', 'available')
            ->where('verification_status', CarRental::VERIFIED);

        if ($type !== null) {
            $query->where('type', $type);
        }

        return $query->orderBy('price')->get();
    }

    /**
     * Cars a customer can book for [start, end): verified, active, not in maintenance,
     * free on those dates, with enough notice and within the owner's min/max days.
     */
    public function search(array $filters, ?CarbonInterface $start, ?CarbonInterface $end, ?int $excludeOwnerId = null): array
    {
        // Only owner-listed cars: old admin-seeded catalogue rows have no owner to confirm a request
        $query = CarRental::query()->with('owner')->whereNotNull('user_id')
            ->where('active', true)->where('verification_status', CarRental::VERIFIED)
            ->where('status', '!=', 'maintenance')
            ->when($excludeOwnerId, fn ($q) => $q->where('user_id', '!=', $excludeOwnerId))
            ->when($filters['type'] ?? null, fn ($q, $type) => $q->where('type', $type))
            ->when($filters['transmission'] ?? null, fn ($q, $t) => $q->where('transmission', $t))
            ->when($filters['seats'] ?? null, fn ($q, $seats) => $q->where('seats', '>=', (int) $seats))
            ->when($filters['max_price'] ?? null, fn ($q, $max) => $q->where('price', '<=', (int) $max))
            ->when($filters['city'] ?? null, fn ($q, $city) => $q->where('city', $city))
            ->when($filters['q'] ?? null, function ($q, $text) {
                $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $text) . '%';
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('make', 'like', $like)
                    ->orWhere('model', 'like', $like)->orWhere('pickup_address', 'like', $like));
            });

        $sort = $filters['sort'] ?? 'price';
        $sort === 'rating' ? $query->orderByDesc('rating')->orderBy('price') : $query->orderBy('price');
        $cars = $query->limit(100)->get();

        if ($start && $end) {
            $days = RentalQuote::days($start, $end);
            $busy = RentalAvailability::busyCarIds($cars->pluck('id'), $start, $end);
            $cars = $cars->filter(fn (CarRental $car) => !in_array($car->id, $busy, true)
                && $start->greaterThanOrEqualTo(now()->addHours((int) $car->notice_hours))
                && $days >= (int) ($car->min_days ?? 1)
                && ($car->max_days === null || $days <= (int) $car->max_days));
        }

        return $cars->values()->map(fn (CarRental $car) => RentalCarPresenter::forCustomer(
            $car, $start && $end ? RentalQuote::quote($car, $start, $end) : null
        ))->all();
    }

    /** Cities that have at least one bookable car, for the search filter */
    public function cities(): array
    {
        return CarRental::where('active', true)->where('verification_status', CarRental::VERIFIED)
            ->whereNotNull('user_id')->whereNotNull('city')->select('city', DB::raw('count(*) as cars'))->groupBy('city')
            ->orderByDesc('cars')->pluck('city')->all();
    }
}
