<?php

namespace App\Modules\Safety\Application;

use App\Models\ActivityLog;
use App\Models\Ride;
use App\Models\RideEvent;
use App\Models\User;
use App\Services\PushService;
use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Providers\Contracts\ProviderDisplay;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Share my trip (S8.1) and SOS (S8.2) */
class SafetyService
{
    public function __construct(private PushService $push, private SmsSender $sms)
    {
    }

    /** Public link to follow an active ride; works only while the ride is active */
    public function share(Ride $ride, User $user): string
    {
        if (!$ride->involves($user)) {
            throw new HttpException(404, 'Ride not found.');
        }
        if (!$ride->isActive()) {
            throw new HttpException(409, 'You can share a trip only while it is active.');
        }
        if (!$ride->share_token) {
            $ride->forceFill(['share_token' => Str::random(40)])->save();
            RideEvent::create(['ride_id' => $ride->id, 'actor_id' => $user->id, 'type' => 'shared']);
        }

        return self::shareUrl($ride->share_token);
    }

    public static function shareUrl(string $token): string
    {
        return rtrim(config('app.url'), '/') . '/t/' . $token;
    }

    /** What anyone with the link sees — first names only, approximate position (S8.1) */
    public static function publicView(Ride $ride): array
    {
        $ride->loadMissing('driver', 'vehicle', 'rider');
        $presence = $ride->driver_id ? \App\Models\DriverPresence::find($ride->driver_id) : null;
        $photos = (array) ($ride->vehicle?->photos ?? []);

        return [
            'status'       => $ride->status,
            'active'       => $ride->isActive(),
            'rider'        => ['first_name' => Str::before(trim((string) $ride->rider?->name), ' ') ?: 'Rider'],
            'driver'       => $ride->driver ? [
                'name'  => app(ProviderDisplay::class)->displayName($ride->driver->name),
                'photo' => preg_match('#^https?://#', (string) $ride->driver->profile_image_url) ? $ride->driver->profile_image_url : null,
            ] : null,
            'vehicle'      => $ride->vehicle ? [
                'model' => trim($ride->vehicle->make . ' ' . $ride->vehicle->model),
                'color' => $ride->vehicle->color,
                'plate' => $ride->vehicle->plate,
                'photo' => $photos['front'] ?? null,
            ] : null,
            // ~100 m precision
            'position'     => $presence && $presence->lat !== null && $ride->isActive()
                ? ['lat' => round($presence->lat, 3), 'lng' => round($presence->lng, 3), 'at' => $presence->last_seen_at?->toIso8601String()]
                : null,
            'pickup'       => $ride->pickup_address,
            'dropoff'      => $ride->dropoff_address,
            'updated_at'   => now()->toIso8601String(),
        ];
    }

    /** SOS: flag the ride, alert admins, text the emergency contact a live link (S8.2) */
    public function sos(Ride $ride, User $user, ?float $lat, ?float $lng): array
    {
        if (!$ride->involves($user)) {
            throw new HttpException(404, 'Ride not found.');
        }
        $link = $ride->isActive() ? $this->share($ride, $user) : null;
        $ride->forceFill(['sos_at' => now(), 'sos_by' => $user->id, 'flagged_at' => $ride->flagged_at ?? now()])->save();
        RideEvent::create(['ride_id' => $ride->id, 'actor_id' => $user->id, 'type' => 'sos',
            'payload' => array_filter(['lat' => $lat, 'lng' => $lng, 'by' => $ride->rider_id === $user->id ? 'rider' : 'driver'])]);

        // High-priority alert for everyone who watches rides
        User::whereHas('role.permissions', fn ($q) => $q->where('name', 'manage-rides'))->whereNotNull('fcm_token')->limit(50)->get()
            ->each(fn (User $admin) => $this->push->send($admin, '🚨 SOS on ride #' . $ride->id,
                sprintf('%s pressed SOS. Open the ride now.', $user->name), ['screen' => 'admin_ride', 'id' => $ride->id]));
        ActivityLog::create(['admin_id' => $user->id, 'action' => 'ride.sos', 'entity_type' => 'ride', 'entity_id' => $ride->id,
            'details' => ['lat' => $lat, 'lng' => $lng]]);

        $contacted = false;
        if ($user->emergency_contact_phone && $this->sms->canSend()) {
            $where = $lat !== null ? sprintf(' Location: https://maps.google.com/?q=%s,%s', $lat, $lng) : '';
            $contacted = $this->sms->send($user->emergency_contact_phone,
                sprintf('%s pressed SOS in a Jali ride.%s%s', Str::before($user->name, ' ') ?: 'Your contact', $where, $link ? " Live: $link" : ''));
        }

        return ['flagged' => true, 'emergency_contact_notified' => $contacted, 'share_url' => $link, 'call' => '112'];
    }
}
