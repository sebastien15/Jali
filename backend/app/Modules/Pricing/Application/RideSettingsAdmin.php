<?php

namespace App\Modules\Pricing\Application;

use App\Models\ActivityLog;
use App\Models\PlatformSetting;
use App\Models\User;
use App\Modules\Pricing\Contracts\ProviderRateRevalidator;

/**
 * Superadmin write path for platform_settings['rides'] (the only one). After a
 * save, provider rates are re-checked against the new limits by their owning
 * service, and the change is logged with how many providers were newly flagged.
 * Input is already validated against RideSettings::rules() by the transport adapter.
 */
class RideSettingsAdmin
{
    public function __construct(private ProviderRateRevalidator $rates)
    {
    }

    public function current(): array
    {
        return RideSettings::get();
    }

    /** @return array the new effective settings */
    public function update(array $validated, User $by): array
    {
        // Only known vehicle classes are stored
        if (isset($validated['vehicle_classes'])) {
            $validated['vehicle_classes'] = array_intersect_key(
                $validated['vehicle_classes'],
                RideSettings::defaults()['vehicle_classes'],
            );
        }

        [$old, $new] = RideSettings::update($validated, $by);
        $flagged = $this->rates->revalidateProviderRates();

        ActivityLog::create([
            'admin_id'    => $by->id,
            'action'      => 'ride_settings_updated',
            'entity_type' => 'platform_setting',
            'entity_id'   => PlatformSetting::where('key', RideSettings::KEY)->value('id'),
            'details'     => ['old' => $old, 'new' => $new, 'drivers_flagged' => $flagged],
        ]);

        return $new;
    }
}
