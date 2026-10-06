<?php

namespace App\Modules\ServiceAccess\Application;

use App\Models\User;
use App\Modules\Locations\Contracts\ServiceAreas;
use App\Modules\Providers\Contracts\ProviderServices;
use App\Modules\ServiceAccess\Contracts\ServiceAccess;

/**
 * Combines release flags (ServiceCatalogue), region (Locations S10.4),
 * permissions and provider verification into one per-service answer (S23.1).
 *
 * reason_code (first that applies, for new requests):
 *   not_released · paused · app_update_required · not_in_area · off_in_area · no_permission
 */
class ServiceAccessResolver implements ServiceAccess
{
    /** Permission to use each service as a customer */
    private const USE = ['rides' => 'request-rides', 'hire' => 'request-rides', 'rental' => 'rent-cars',
        'shared' => 'create-bookings', 'bus' => 'create-bookings', 'cargo' => null];
    /** Permission + verified driver-profile service needed to take work */
    private const OFFER = ['rides' => ['offer-rides', 'ride'], 'hire' => ['offer-driver-hire', 'hire'],
        'rental' => ['offer-rentals', null], 'shared' => ['create-private-seats', null], 'bus' => null, 'cargo' => null];
    /** Permission to set the service up as a provider (apply, list a car…) */
    private const CONFIGURE = ['rides' => 'apply-as-driver', 'hire' => 'apply-as-driver', 'rental' => 'offer-rentals',
        'shared' => 'create-private-seats', 'bus' => null, 'cargo' => null];
    /** Services bound to where the customer is (on-demand, local) */
    private const LOCAL = ['rides', 'hire'];

    public function __construct(private ServiceAreas $areas, private ProviderServices $providers)
    {
    }

    public function forUser(User $user, ?float $lat = null, ?float $lng = null, ?string $appVersion = null): array
    {
        $appVersion ??= self::clientVersion();
        $catalogue = ServiceCatalogue::get();
        $verified = $this->providers->verifiedServices($user);

        $services = [];
        foreach (self::SERVICES as $id) {
            $flags = $catalogue[$id];
            $reason = self::releaseReason($flags, $appVersion);
            $area = null;
            if ($lat !== null && $lng !== null) {
                $where = $this->areas->availability($lat, $lng, $id);
                $area = $where['area'];
                if (!$where['served'] && $reason === null && ($area !== null || in_array($id, self::LOCAL, true))) {
                    $reason = $area === null ? 'not_in_area' : 'off_in_area';
                }
            }
            $canUse = self::USE[$id] !== null && $user->hasPermission(self::USE[$id]);
            if ($reason === null && !$canUse) {
                $reason = 'no_permission';
            }
            $offer = self::OFFER[$id];
            $canOffer = $offer !== null && $flags['accepting_new_requests'] && $user->hasPermission($offer[0])
                && ($offer[1] === null || in_array($offer[1], $verified, true));

            $services[] = [
                'id'                     => $id,
                'label'                  => ServiceCatalogue::LABELS[$id],
                'discoverable'           => (bool) $flags['discoverable'],
                'accepting_new_requests' => $reason === null,
                'can_use'                => $canUse,
                'can_offer'              => $canOffer,
                'can_configure'          => self::CONFIGURE[$id] !== null && $flags['discoverable'] && $user->hasPermission(self::CONFIGURE[$id]),
                'reason_code'            => $reason,
                'minimum_app_version'    => $flags['minimum_app_version'],
                'area'                   => $area,
            ];
        }

        return ['version' => self::VERSION, 'services' => $services];
    }

    public function assertAcceptingNew(string $service, ?string $appVersion = null): void
    {
        $flags = ServiceCatalogue::get()[$service] ?? null;
        $reason = $flags === null ? 'not_released' : self::releaseReason($flags, $appVersion ?? self::clientVersion());
        if ($reason === null) {
            return;
        }
        $label = ServiceCatalogue::LABELS[$service] ?? ucfirst($service);
        throw new ServiceUnavailable($reason, match ($reason) {
            'app_update_required' => "Update the Jali app to use {$label}.",
            'not_released'        => "{$label} is not available yet.",
            default               => "{$label} is not taking new requests right now. Your existing bookings are not affected.",
        });
    }

    private static function releaseReason(array $flags, ?string $appVersion): ?string
    {
        if (!$flags['discoverable'] && !$flags['accepting_new_requests']) {
            return 'not_released';
        }
        if (!$flags['accepting_new_requests']) {
            return 'paused';
        }
        $min = $flags['minimum_app_version'];
        // Clients that don't send a version (older builds) are not version-gated.
        if ($min && $appVersion && version_compare($appVersion, $min, '<')) {
            return 'app_update_required';
        }

        return null;
    }

    private static function clientVersion(): ?string
    {
        $v = app()->bound('request') ? request()->header('X-App-Version') : null;

        return is_string($v) && preg_match('/^\d+(\.\d+){0,2}$/', $v) ? $v : null;
    }
}
