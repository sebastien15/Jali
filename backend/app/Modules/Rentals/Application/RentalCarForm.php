<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;
use Illuminate\Validation\Rule;

/**
 * Owner listing fields for a rental car (story S24.8 and the owner's request for
 * "registration with images, full description and custom rules"). Old clients
 * that send only name/type/plate/seats/priceDay keep working.
 */
class RentalCarForm
{
    public const MAX_RULES = 15;
    public const MAX_PHOTOS = 12;

    public static function rules(bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';

        return [
            'name'                 => [$creating ? 'required_without:make' : 'sometimes', 'string', 'max:120'],
            'make'                 => ['nullable', 'string', 'max:60'],
            'model'                => ['nullable', 'string', 'max:60'],
            'year'                 => ['nullable', 'integer', 'min:1980', 'max:' . (now()->year + 1)],
            'color'                => ['nullable', 'string', 'max:30'],
            'type'                 => [$req, Rule::in(CarRental::TYPES)],
            'plate'                => [$req, 'string', 'max:20'],
            'seats'                => [$req, 'integer', 'min:1', 'max:60'],
            'priceDay'             => [$req, 'integer', 'min:0', 'max:10000000'],
            'caution'              => ['nullable', 'integer', 'min:0', 'max:50000000'],
            'transmission'         => ['nullable', Rule::in(CarRental::TRANSMISSIONS)],
            'fuel_type'            => ['nullable', Rule::in(CarRental::FUEL_TYPES)],
            'doors'                => ['nullable', 'integer', 'min:2', 'max:6'],
            'luggage'              => ['nullable', 'integer', 'min:0', 'max:20'],
            'description'          => ['nullable', 'string', 'max:2000'],
            'city'                 => ['nullable', 'string', 'max:60'],
            'pickup_address'       => ['nullable', 'string', 'max:255'],
            'pickup_lat'           => ['nullable', 'numeric', 'between:-90,90'],
            'pickup_lng'           => ['nullable', 'numeric', 'between:-180,180'],
            'delivery_available'   => ['sometimes', 'boolean'],
            'delivery_fee'         => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'mileage_limit_km'     => ['nullable', 'integer', 'min:10', 'max:5000'],
            'extra_km_fee'         => ['nullable', 'integer', 'min:0', 'max:100000'],
            'fuel_policy'          => ['nullable', Rule::in(CarRental::FUEL_POLICIES)],
            'min_driver_age'       => ['nullable', 'integer', 'min:18', 'max:80'],
            'min_licence_years'    => ['nullable', 'integer', 'min:0', 'max:40'],
            'min_days'             => ['nullable', 'integer', 'min:1', 'max:90'],
            'max_days'             => ['nullable', 'integer', 'min:1', 'max:365', 'gte:min_days'],
            'notice_hours'         => ['nullable', 'integer', 'min:0', 'max:336'],
            'weekly_discount_pct'  => ['nullable', 'integer', 'min:0', 'max:70'],
            'monthly_discount_pct' => ['nullable', 'integer', 'min:0', 'max:80'],
            'cancellation_policy'  => ['nullable', Rule::in(CarRental::CANCELLATION_POLICIES)],
            'allowed'              => ['nullable', 'array'],
            'allowed.*'            => ['boolean'],
            'rules'                => ['nullable', 'array', 'max:' . self::MAX_RULES],
            'rules.*'              => ['string', 'min:3', 'max:200'],
            'insurance_expiry'     => ['nullable', 'date', 'after:today'],
            'amenities'            => ['nullable', 'array'],
            'photos'               => ['nullable', 'array'],
            'status'               => ['sometimes', Rule::in(['available', 'rented', 'maintenance'])],
            'notes'                => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** Validated input → model attributes */
    public static function attributes(array $validated): array
    {
        if (array_key_exists('priceDay', $validated)) {
            $validated['price'] = $validated['priceDay'];
            unset($validated['priceDay']);
        }
        if (empty($validated['name']) && (!empty($validated['make']) || !empty($validated['model']))) {
            $validated['name'] = trim(($validated['make'] ?? '') . ' ' . ($validated['model'] ?? ''));
        }
        if (array_key_exists('allowed', $validated)) {
            $validated['allowed'] = self::allowed($validated['allowed']);
        }
        if (array_key_exists('rules', $validated)) {
            $validated['rules'] = array_values(array_filter(array_map('trim', (array) $validated['rules'])));
        }
        if (array_key_exists('plate', $validated)) {
            $validated['plate'] = strtoupper(trim($validated['plate']));
        }
        foreach (['caution', 'delivery_fee', 'extra_km_fee', 'weekly_discount_pct', 'monthly_discount_pct'] as $zeroable) {
            if (array_key_exists($zeroable, $validated) && $validated[$zeroable] === null) {
                $validated[$zeroable] = 0;
            }
        }

        return $validated;
    }

    /** Known permission flags with defaults (no smoking, no pets, Kigali and upcountry OK, no border crossing) */
    public static function allowed(?array $allowed): array
    {
        $defaults = ['smoking' => false, 'pets' => false, 'outside_kigali' => true, 'cross_border' => false];
        $allowed = (array) $allowed;

        return array_map(fn ($key) => (bool) ($allowed[$key] ?? $defaults[$key]), array_combine(CarRental::ALLOWED_KEYS, CarRental::ALLOWED_KEYS));
    }
}
