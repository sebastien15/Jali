<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;
use App\Models\RentalBooking;

/** Shapes of a rental car for its owner and for customers. */
class RentalCarPresenter
{
    /** Owner-facing car shape: every column plus `priceDay` (= DB column `price`) and review state */
    public static function toFrontend(CarRental $car): array
    {
        $data             = $car->toArray();
        $data['priceDay'] = $car->price;
        $data['allowed']  = RentalCarForm::allowed($car->allowed);
        $data['rules']    = array_values((array) $car->rules);
        $data['photos']   = array_values((array) $car->photos);
        $data['verification_note'] = $car->verification_note;
        $data['documents'] = collect(CarRental::DOCUMENT_TYPES)
            ->mapWithKeys(fn ($type) => [$type => !empty(((array) $car->documents)[$type] ?? null)])->all();
        $data['listing_complete'] = self::missing($car) === [];
        $data['missing'] = self::missing($car);
        $data['open_rentals'] = RentalBooking::where('car_rental_id', $car->id)->whereIn('status', RentalBooking::OPEN)->count();

        return $data;
    }

    /** What the owner still has to add before the listing is ready for review */
    public static function missing(CarRental $car): array
    {
        $missing = [];
        if (count((array) $car->photos) < 3) $missing[] = 'photos';
        if (empty(((array) $car->documents)['registration'] ?? null)) $missing[] = 'registration';
        if (empty(((array) $car->documents)['insurance'] ?? null)) $missing[] = 'insurance';
        if (!$car->pickup_address) $missing[] = 'pickup_address';
        if (!$car->transmission) $missing[] = 'transmission';
        if (!$car->description) $missing[] = 'description';

        return $missing;
    }

    /** Customer-facing car (search results and detail). Owner contact only after acceptance. */
    public static function forCustomer(CarRental $car, ?array $quote = null, bool $detail = false): array
    {
        $owner = $car->owner;
        $data = [
            'id'                   => $car->id,
            'name'                 => $car->name,
            'make'                 => $car->make,
            'model'                => $car->model,
            'year'                 => $car->year,
            'color'                => $car->color,
            'type'                 => $car->type,
            'seats'                => (int) $car->seats,
            'doors'                => $car->doors,
            'luggage'              => $car->luggage,
            'transmission'         => $car->transmission,
            'fuel_type'            => $car->fuel_type,
            'photos'               => array_values((array) $car->photos),
            'rating'               => (float) $car->rating,
            'trips_count'          => (int) $car->trips_count,
            'price_per_day'        => (int) $car->price,
            'deposit'              => (int) $car->caution,
            'city'                 => $car->city,
            'pickup_address'       => $car->pickup_address,
            'delivery_available'   => (bool) $car->delivery_available,
            'delivery_fee'         => (int) $car->delivery_fee,
            'weekly_discount_pct'  => (int) $car->weekly_discount_pct,
            'monthly_discount_pct' => (int) $car->monthly_discount_pct,
            'amenities'            => array_values((array) $car->amenities),
            'owner'                => $owner ? [
                'first_name'   => strtok((string) $owner->name, ' ') ?: 'Owner',
                'member_since' => $owner->created_at?->toDateString(),
            ] : null,
            'quote'                => $quote,
        ];
        if ($detail) {
            $data += [
                'description'      => $car->description,
                'pickup_lat'       => $car->pickup_lat,
                'pickup_lng'       => $car->pickup_lng,
                'min_days'         => (int) ($car->min_days ?? 1),
                'max_days'         => $car->max_days,
                'notice_hours'     => (int) ($car->notice_hours ?? 0),
                'terms'            => RentalQuote::terms($car),
                'busy'             => RentalAvailability::busyRanges($car),
            ];
        }

        return $data;
    }
}
