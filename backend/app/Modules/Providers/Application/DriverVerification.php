<?php

namespace App\Modules\Providers\Application;

use App\Models\ActivityLog;
use App\Models\DriverDocument;
use App\Models\DriverProfile;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\User;
use App\Modules\Identity\Contracts\ProviderRoles;
use App\Modules\Notifications\Contracts\PushSender;
use App\Modules\Pricing\Contracts\PricingPolicy;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Driver verification queue (story S1.4) and drivers needing review (S8.4),
 * /admin/drivers/**. The transport checks the reviewer's verify-drivers
 * permission and validates input. Every decision is logged and pushed to the driver.
 */
class DriverVerification
{
    public function __construct(
        private readonly PushSender $push,
        private readonly PricingPolicy $pricing,
        private readonly ProviderRoles $roles,
    ) {
    }

    /** Submitted applications in one status, oldest submission first. */
    public function queue(string $status): Collection
    {
        $profiles = DriverProfile::with('user')
            ->where('verification_status', $status)
            ->whereNotNull('submitted_at')
            ->orderBy('submitted_at')
            ->limit(200)
            ->get();

        return $profiles->map(fn (DriverProfile $p) => [
            'user_id'      => $p->user_id,
            'name'         => $p->user->name,
            'phone'        => $p->user->phone,
            'services'     => $p->services ?? [],
            'status'       => $p->verification_status,
            'submitted_at' => $p->submitted_at?->toIso8601String(),
        ])->values();
    }

    /**
     * S8.4: verified drivers rated below the minimum after enough rated trips,
     * or cancelling more than the allowed share of their accepted rides recently.
     */
    public function needingReview(): array
    {
        $rules = $this->pricing->settings()['review'];
        $since = now()->subDays((int) $rules['days']);

        $cancels = Ride::where('accepted_at', '>=', $since)->whereNotNull('driver_id')
            ->selectRaw('driver_id, COUNT(*) as accepted, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as cancelled', [Ride::CANCELLED_BY_DRIVER])
            ->groupBy('driver_id')->get()->keyBy('driver_id');

        $profiles = DriverProfile::with('user')->where('verification_status', DriverProfile::STATUS_VERIFIED)
            ->where(fn ($q) => $q->where(fn ($q) => $q->where('rating_count', '>=', (int) $rules['min_rated_trips'])->where('rating_avg', '<', (float) $rules['min_rating']))
                ->orWhereIn('user_id', $cancels->keys()))
            ->get();

        $items = [];
        foreach ($profiles as $p) {
            $c = $cancels[$p->user_id] ?? null;
            $cancelPct = $c && $c->accepted ? round($c->cancelled * 100 / $c->accepted, 1) : 0.0;
            $reasons = [];
            if ($p->rating_count >= (int) $rules['min_rated_trips'] && $p->rating_avg < (float) $rules['min_rating']) {
                $reasons[] = 'low_rating';
            }
            if ($c && $c->accepted >= (int) $rules['min_accepted'] && $cancelPct > (float) $rules['max_cancel_pct']) {
                $reasons[] = 'high_cancel_rate';
            }
            if (!$reasons) {
                continue;
            }
            $items[] = [
                'user_id' => $p->user_id, 'name' => $p->user?->name, 'phone' => $p->user?->phone,
                'rating' => (float) $p->rating_avg, 'rating_count' => (int) $p->rating_count,
                'accepted' => (int) ($c->accepted ?? 0), 'cancelled' => (int) ($c->cancelled ?? 0), 'cancel_pct' => $cancelPct,
                'reasons' => $reasons, 'warned_at' => $p->warned_at?->toIso8601String(),
            ];
        }

        return $items;
    }

    /** S8.4: any driver with a profile (also ones verified before the app flow) is notified; logged. */
    public function warn(User $admin, int $userId, string $message): void
    {
        $user = User::with('driverProfile')->findOrFail($userId);
        abort_unless($user->driverProfile, 404);

        $user->driverProfile->forceFill(['warned_at' => now(), 'warning' => $message])->save();
        $this->log($admin, 'driver_warned', $user, ['message' => $message]);
        $this->push->send($user, 'A note from Jali about your driving', $message, ['screen' => 'driver']);
    }

    /**
     * A user who submitted a driver application; 404 for anyone else.
     *
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException
     */
    public function applicant(int $userId): User
    {
        $user = User::with('driverProfile', 'driverDocuments', 'vehicles', 'role')->findOrFail($userId);
        abort_unless($user->driverProfile && $user->driverProfile->submitted_at, 404);

        return $user;
    }

    /** @throws ProviderRequestRejected only pending applications */
    public function verify(User $admin, User $user): array
    {
        $profile = $user->driverProfile;

        if ($profile->verification_status !== DriverProfile::STATUS_PENDING) {
            throw ProviderRequestRejected::message(409, 'Only pending applications can be approved.');
        }

        DB::transaction(function () use ($user, $profile, $admin) {
            $profile->forceFill([
                'verification_status' => DriverProfile::STATUS_VERIFIED,
                'verified_by'         => $admin->id,
                'verified_at'         => now(),
                'rejection_reason'    => null,
            ])->save();

            $user->driverDocuments()->update([
                'status' => DriverDocument::STATUS_APPROVED, 'rejection_reason' => null,
                'reviewed_by' => $admin->id, 'reviewed_at' => now(),
            ]);
            $user->vehicles()->whereNull('verified_at')->update(['verified_at' => now()]);

            // Riders become drivers; staff keep their admin role (Identity owns roles)
            $this->roles->promoteVerifiedProvider($user);
        });

        $this->log($admin, 'driver_verified', $user);
        $this->push->send($user, 'You are now a Jali driver 🎉', 'Your application was approved. Go online to start earning.',
            ['screen' => 'driver']);

        return $this->detail($user->fresh());
    }

    /**
     * @param array{reason: string, documents?: array<string, string>} $validated
     * @throws ProviderRequestRejected only pending applications
     */
    public function reject(User $admin, User $user, array $validated): array
    {
        $profile = $user->driverProfile;

        if ($profile->verification_status !== DriverProfile::STATUS_PENDING) {
            throw ProviderRequestRejected::message(409, 'Only pending applications can be rejected.');
        }

        DB::transaction(function () use ($user, $profile, $admin, $validated) {
            $profile->forceFill([
                'verification_status' => DriverProfile::STATUS_REJECTED,
                'rejection_reason'    => $validated['reason'],
            ])->save();

            foreach ($validated['documents'] ?? [] as $type => $reason) {
                $user->driverDocuments()->where('type', $type)->update([
                    'status' => DriverDocument::STATUS_REJECTED, 'rejection_reason' => $reason,
                    'reviewed_by' => $admin->id, 'reviewed_at' => now(),
                ]);
            }
        });

        $this->log($admin, 'driver_rejected', $user, ['reason' => $validated['reason']]);
        $this->push->send($user, 'Your driver application needs changes', $validated['reason'], ['screen' => 'driver_onboarding']);

        return $this->detail($user->fresh());
    }

    /**
     * A suspended driver can no longer go online or accept rides (checked by presence/dispatch).
     *
     * @throws ProviderRequestRejected an admin cannot suspend themselves
     */
    public function suspend(User $admin, User $user, string $reason): array
    {
        if ($user->is($admin)) {
            throw ProviderRequestRejected::message(409, 'You cannot suspend yourself.');
        }

        $user->driverProfile->forceFill([
            'verification_status' => DriverProfile::STATUS_SUSPENDED,
            'rejection_reason'    => $reason,
        ])->save();

        $this->log($admin, 'driver_suspended', $user, ['reason' => $reason]);
        $this->push->send($user, 'Your driver account is suspended', $reason, ['screen' => 'driver_onboarding']);

        return $this->detail($user->fresh());
    }

    /** GET /admin/drivers/{userId} body. */
    public function detail(User $user): array
    {
        $user->load('driverProfile', 'driverDocuments', 'vehicles', 'role');
        $profile = $user->driverProfile;

        return [
            'user' => [
                'id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'phone' => $user->phone,
                'role' => $user->role?->name ?? 'user', 'profile_image_url' => $user->profile_image_url,
            ],
            'status'           => $profile->verification_status,
            'submitted_at'     => $profile->submitted_at?->toIso8601String(),
            'verified_at'      => $profile->verified_at?->toIso8601String(),
            'rejection_reason' => $profile->rejection_reason,
            'services'         => $profile->services ?? [],
            'licence'          => [
                'licence_no'         => $profile->licence_no,
                'licence_categories' => $profile->licence_categories ?? [],
                'licence_expiry'     => $profile->licence_expiry?->format('Y-m-d'),
                'national_id_no'     => $profile->national_id_no,
            ],
            'checklist' => DriverOnboarding::checklist($user)['steps'],
            'documents' => DriverApplication::documentsPayload($user),
            'vehicles'  => $user->vehicles->values(),
            'rates'     => DriverRate::where('user_id', $user->id)->get()->map(fn ($r) => ['vehicle_id' => $r->vehicle_id] + $r->fareSnapshot())->values(),
        ];
    }

    private function log(User $admin, string $action, User $driver, array $details = []): void
    {
        ActivityLog::create([
            'admin_id'    => $admin->id,
            'action'      => $action,
            'entity_type' => 'driver',
            'entity_id'   => $driver->id,
            'details'     => ['name' => $driver->name] + $details,
        ]);
    }
}
