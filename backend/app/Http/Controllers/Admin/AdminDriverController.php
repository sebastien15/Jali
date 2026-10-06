<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\DriverOnboardingController;
use App\Models\ActivityLog;
use App\Models\DriverDocument;
use App\Models\DriverProfile;
use App\Models\DriverRate;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use App\Services\Rides\DriverOnboarding;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Driver verification queue (story S1.4). Requires verify-drivers.
 */
class AdminDriverController extends Controller
{
    private const STATUSES = ['pending', 'verified', 'rejected', 'suspended'];

    /** GET /admin/drivers?status=pending — oldest submission first */
    public function index(Request $request)
    {
        $this->authorizeReviewer($request);
        $status = $request->validate(['status' => ['sometimes', Rule::in(self::STATUSES)]])['status'] ?? 'pending';

        $profiles = DriverProfile::with('user')
            ->where('verification_status', $status)
            ->whereNotNull('submitted_at')
            ->orderBy('submitted_at')
            ->limit(200)
            ->get();

        return response()->json($profiles->map(fn (DriverProfile $p) => [
            'user_id'      => $p->user_id,
            'name'         => $p->user->name,
            'phone'        => $p->user->phone,
            'services'     => $p->services ?? [],
            'status'       => $p->verification_status,
            'submitted_at' => $p->submitted_at?->toIso8601String(),
        ])->values());
    }

    /**
     * GET /admin/drivers/review — S8.4: drivers rated below the minimum after enough rated trips,
     * or cancelling more than the allowed share of their accepted rides recently.
     */
    public function review(Request $request)
    {
        $this->authorizeReviewer($request);
        $rules = \App\Services\Rides\RideSettings::get()['review'];
        $since = now()->subDays((int) $rules['days']);

        $cancels = \App\Models\Ride::where('accepted_at', '>=', $since)->whereNotNull('driver_id')
            ->selectRaw('driver_id, COUNT(*) as accepted, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as cancelled', [\App\Models\Ride::CANCELLED_BY_DRIVER])
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

        return response()->json($items);
    }

    /** POST /admin/drivers/{userId}/warn {message} — S8.4: the driver is notified and it is logged */
    public function warn(Request $request, PushService $push, int $userId)
    {
        $admin = $this->authorizeReviewer($request);
        $message = $request->validate(['message' => 'required|string|min:5|max:500'])['message'];
        $user = User::with('driverProfile')->findOrFail($userId);   // any driver, also ones verified before the app flow
        abort_unless($user->driverProfile, 404);

        $user->driverProfile->forceFill(['warned_at' => now(), 'warning' => $message])->save();
        $this->log($admin, 'driver_warned', $user, ['message' => $message]);
        $push->send($user, 'A note from Jali about your driving', $message, ['screen' => 'driver']);

        return response()->json(['message' => 'Warning sent.', 'warned_at' => now()->toIso8601String()]);
    }

    /** GET /admin/drivers/{userId} */
    public function show(Request $request, int $userId)
    {
        $this->authorizeReviewer($request);

        return response()->json($this->detail($this->applicant($userId)));
    }

    /** POST /admin/drivers/{userId}/verify */
    public function verify(Request $request, PushService $push, int $userId)
    {
        $admin = $this->authorizeReviewer($request);
        $user = $this->applicant($userId);
        $profile = $user->driverProfile;

        if ($profile->verification_status !== DriverProfile::STATUS_PENDING) {
            return response()->json(['message' => 'Only pending applications can be approved.'], 409);
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

            // Riders become drivers; staff keep their admin role
            if (!$user->role || $user->role->name === 'user') {
                $user->update(['role_id' => Role::where('name', 'driver')->value('id')]);
            }
        });

        $this->log($admin, 'driver_verified', $user);
        $push->send($user, 'You are now a Jali driver 🎉', 'Your application was approved. Go online to start earning.',
            ['screen' => 'driver']);

        return response()->json($this->detail($user->fresh()));
    }

    /** POST /admin/drivers/{userId}/reject  { reason, documents?: {type: reason} } */
    public function reject(Request $request, PushService $push, int $userId)
    {
        $admin = $this->authorizeReviewer($request);
        $validated = $request->validate([
            'reason'      => 'required|string|max:500',
            'documents'   => 'sometimes|array',
            'documents.*' => 'string|max:255',
        ]);
        $user = $this->applicant($userId);
        $profile = $user->driverProfile;

        if ($profile->verification_status !== DriverProfile::STATUS_PENDING) {
            return response()->json(['message' => 'Only pending applications can be rejected.'], 409);
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
        $push->send($user, 'Your driver application needs changes', $validated['reason'], ['screen' => 'driver_onboarding']);

        return response()->json($this->detail($user->fresh()));
    }

    /** POST /admin/drivers/{userId}/suspend  { reason } */
    public function suspend(Request $request, PushService $push, int $userId)
    {
        $admin = $this->authorizeReviewer($request);
        $validated = $request->validate(['reason' => 'required|string|max:500']);
        $user = $this->applicant($userId);

        if ($user->is($admin)) {
            return response()->json(['message' => 'You cannot suspend yourself.'], 409);
        }

        // A suspended driver can no longer go online or accept rides (checked by presence/dispatch)
        $user->driverProfile->forceFill([
            'verification_status' => DriverProfile::STATUS_SUSPENDED,
            'rejection_reason'    => $validated['reason'],
        ])->save();

        $this->log($admin, 'driver_suspended', $user, ['reason' => $validated['reason']]);
        $push->send($user, 'Your driver account is suspended', $validated['reason'], ['screen' => 'driver_onboarding']);

        return response()->json($this->detail($user->fresh()));
    }

    private function authorizeReviewer(Request $request): User
    {
        $user = $request->user();
        abort_unless($user->hasPermission('verify-drivers'), 403);

        return $user;
    }

    private function applicant(int $userId): User
    {
        $user = User::with('driverProfile', 'driverDocuments', 'vehicles', 'role')->findOrFail($userId);
        abort_unless($user->driverProfile && $user->driverProfile->submitted_at, 404);

        return $user;
    }

    private function detail(User $user): array
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
            'documents' => DriverOnboardingController::documentsPayload($user),
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
