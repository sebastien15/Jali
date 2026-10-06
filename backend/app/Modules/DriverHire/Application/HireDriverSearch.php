<?php

namespace App\Modules\DriverHire\Application;

use App\Models\DriverHireSetting;
use App\Models\DriverProfile;
use App\Models\User;
use App\Modules\Providers\Contracts\ProviderDisplay;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Which drivers a customer can hire (story S6.3): verified, active hire
 * settings, offer-driver-hire permission, drives the customer's transmission
 * and free for the whole window. Input is already validated.
 */
class HireDriverSearch
{
    private const MAX_RESULTS = 50;

    public function __construct(private ProviderDisplay $display)
    {
    }

    /** Free drivers with their quote, best rated first, then cheapest */
    public function available(User $customer, array $data, CarbonInterface $start): Collection
    {
        $withCar = !empty($data['with_car']);
        $settings = DriverHireSetting::with('user.driverProfile', 'user.role', 'carVehicle')
            ->where('is_active', true)
            ->whereNot('user_id', $customer->id)
            ->whereHas('user.driverProfile', fn ($q) => $q->where('verification_status', DriverProfile::STATUS_VERIFIED))
            ->get()
            ->filter(fn (DriverHireSetting $s) => $s->user->hasPermission('offer-driver-hire')
                && ($withCar ? $s->carReady() : in_array($data['transmission'], $s->user->driverProfile->transmissions ?? [], true)));

        return $settings->map(function (DriverHireSetting $s) use ($data, $start, $withCar) {
            $end = HireQuote::endAt($start, $data['duration_type'], (int) $data['duration_value'], $s->daily_hours);
            if (!HireAvailability::isFree($s->user_id, $start, $end)) {
                return null;
            }
            $profile = $s->user->driverProfile;
            $quote = HireQuote::quote($s->snapshot(), $data['duration_type'], (int) $data['duration_value'], $data['trip_type'], $withCar);
            $car = $withCar ? $s->carVehicle : null;

            return [
                'driver_id'          => $s->user_id,
                'name'               => $this->display->displayName($s->user->name),
                'photo'              => preg_match('#^https?://#', (string) $s->user->profile_image_url) ? $s->user->profile_image_url : null,
                'rating'             => (float) $profile->rating_avg,
                'rating_count'       => (int) $profile->rating_count,
                'trips_count'        => (int) $profile->trips_count,
                'years_experience'   => $profile->years_experience,
                'languages'          => $profile->languages ?? [],
                'transmissions'      => $profile->transmissions ?? [],
                'licence_categories' => $profile->licence_categories ?? [],
                'rates'              => $s->snapshot(),
                'end_at'             => $end->toIso8601String(),
                'quote'              => $quote,
                // S13.7: the car they bring (plate shared after acceptance)
                'vehicle'            => $car ? ['model' => trim(($car->make ? $car->make . ' ' : '') . $car->model), 'color' => $car->color,
                    'class' => $car->class, 'seats' => $car->seats, 'photo' => ((array) ($car->photos ?? []))['front'] ?? null] : null,
            ];
        })->filter()
            ->sortBy([['rating', 'desc'], fn ($a, $b) => $a['quote']['total'] <=> $b['quote']['total']])
            ->take(self::MAX_RESULTS)->values();
    }

    /** The driver the customer asked for, or null when they can't be hired */
    public function bookableDriver(User $customer, array $data): ?User
    {
        $driver = User::with('driverProfile', 'hireSettings')->find($data['driver_id']);

        $bookable = $driver && $driver->id !== $customer->id && $driver->hireSettings?->is_active
            && $driver->driverProfile?->isVerified() && $driver->hasPermission('offer-driver-hire')
            && (!empty($data['with_car']) ? $driver->hireSettings->carReady()
                : in_array($data['transmission'], $driver->driverProfile->transmissions ?? [], true));

        return $bookable ? $driver : null;
    }
}
