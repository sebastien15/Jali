<?php

namespace App\Modules\ServiceAccess\Application;

use App\Models\ActivityLog;
use App\Models\PlatformSetting;
use App\Models\User;
use App\Modules\ServiceAccess\Contracts\ServiceAccess;

/**
 * Release flags per service, stored in platform_settings['services'] (S23.1).
 * Defaults keep today's behaviour for every built service; cargo is not built,
 * so it can't be switched on (missing or unknown data never enables it).
 *
 *   discoverable            — shown in navigation
 *   accepting_new_requests  — new bookings/requests are taken (existing work is never gated)
 *   minimum_app_version     — older app versions see "update the app" for new requests
 */
class ServiceCatalogue
{
    public const KEY = 'services';
    public const NOT_BUILT = ['cargo'];

    public const LABELS = [
        'rides' => 'Rides', 'hire' => 'Hire a driver', 'rental' => 'Car rental',
        'shared' => 'Shared journeys', 'bus' => 'Bus tickets', 'cargo' => 'Cargo',
    ];

    public static function defaults(): array
    {
        $out = [];
        foreach (ServiceAccess::SERVICES as $id) {
            $built = !in_array($id, self::NOT_BUILT, true);
            $out[$id] = ['discoverable' => $built, 'accepting_new_requests' => $built, 'minimum_app_version' => null];
        }

        return $out;
    }

    public static function get(): array
    {
        $saved = PlatformSetting::where('key', self::KEY)->value('value');
        $merged = self::defaults();
        foreach (is_array($saved) ? $saved : [] as $id => $flags) {
            if (isset($merged[$id]) && is_array($flags) && !in_array($id, self::NOT_BUILT, true)) {
                $merged[$id] = array_replace($merged[$id], array_intersect_key($flags, $merged[$id]));
            }
        }

        return $merged;
    }

    public static function rules(): array
    {
        $rules = [];
        foreach (ServiceAccess::SERVICES as $id) {
            $rules[$id] = 'sometimes|array';
            $rules["$id.discoverable"] = in_array($id, self::NOT_BUILT, true) ? 'sometimes|boolean|declined' : 'sometimes|boolean';
            $rules["$id.accepting_new_requests"] = in_array($id, self::NOT_BUILT, true) ? 'sometimes|boolean|declined' : 'sometimes|boolean';
            $rules["$id.minimum_app_version"] = ['sometimes', 'nullable', 'string', 'max:20', 'regex:/^\d+(\.\d+){0,2}$/'];
        }

        return $rules;
    }

    public static function messages(): array
    {
        return ['*.discoverable.declined' => 'This service is not built yet.', '*.accepting_new_requests.declined' => 'This service is not built yet.'];
    }

    /** @return array the new effective catalogue */
    public static function update(array $values, User $by): array
    {
        $old = self::get();
        $new = $old;
        foreach (array_intersect_key($values, $old) as $id => $flags) {
            $new[$id] = array_replace($new[$id], array_intersect_key((array) $flags, $new[$id]));
        }
        PlatformSetting::updateOrCreate(['key' => self::KEY], ['value' => $new, 'updated_by' => $by->id]);
        ActivityLog::create([
            'admin_id' => $by->id, 'action' => 'services_updated', 'entity_type' => 'platform_setting',
            'entity_id' => PlatformSetting::where('key', self::KEY)->value('id'), 'details' => ['old' => $old, 'new' => $new],
        ]);

        return $new;
    }
}
