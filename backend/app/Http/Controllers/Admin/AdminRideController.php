<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\DriverPresence;
use App\Models\Ride;
use App\Models\RideEvent;
use App\Models\RideRating;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Ride operations for admins (stories S10.1, S10.2). Requires manage-rides.
 * Admins see full names and phone numbers — every adjustment is logged.
 */
class AdminRideController extends Controller
{
    private const STATUSES = [
        Ride::REQUESTED, Ride::ACCEPTED, Ride::ARRIVED, Ride::IN_PROGRESS, Ride::COMPLETED,
        Ride::DECLINED, Ride::EXPIRED, Ride::CANCELLED_BY_RIDER, Ride::CANCELLED_BY_DRIVER,
    ];

    /** GET /admin/rides/live — online drivers, active rides and counters (S10.1) */
    public function live(Request $request)
    {
        $this->authorizeOps($request);

        $presence = DriverPresence::live()->with('driver', 'vehicle')->get();
        $busy = Ride::whereIn('status', Ride::ONGOING)->whereIn('driver_id', $presence->pluck('user_id'))->pluck('driver_id')->flip();
        $active = Ride::whereIn('status', Ride::ACTIVE)->with('rider', 'driver')->orderByDesc('id')->limit(500)->get();

        return response()->json([
            'counters' => [
                'drivers_online'          => $presence->count(),
                'drivers_online_by_class' => (object) $presence->groupBy(fn ($p) => $p->vehicle?->class ?? 'unknown')->map->count()->all(),
                'drivers_on_trip'         => $busy->count(),
                'rides_by_status'         => (object) $active->groupBy('status')->map->count()->all(),
                'expired_last_hour'       => Ride::where('status', Ride::EXPIRED)->where('updated_at', '>=', now()->subHour())->count(),
                'completed_today'         => Ride::where('status', Ride::COMPLETED)->where('completed_at', '>=', now('Africa/Kigali')->startOfDay()->utc())->count(),
            ],
            'drivers' => $presence->map(fn (DriverPresence $p) => [
                'user_id'      => $p->user_id,
                'name'         => $p->driver?->name,
                'class'        => $p->vehicle?->class,
                'plate'        => $p->vehicle?->plate,
                'lat'          => $p->lat,
                'lng'          => $p->lng,
                'on_trip'      => $busy->has($p->user_id),
                'last_seen_at' => $p->last_seen_at?->toIso8601String(),
            ])->values(),
            'rides' => $active->map(fn (Ride $r) => $this->summary($r))->values(),
        ]);
    }

    /** GET /admin/rides?status&from&to&rider&driver&flagged&page (S10.2) */
    public function index(Request $request)
    {
        $this->authorizeOps($request);
        $filters = $request->validate([
            'status'  => ['sometimes', Rule::in(self::STATUSES)],
            'from'    => ['sometimes', 'date'],
            'to'      => ['sometimes', 'date'],
            'rider'   => ['sometimes', 'string', 'max:100'],
            'driver'  => ['sometimes', 'string', 'max:100'],
            'flagged' => ['sometimes', 'boolean'],
        ]);

        $query = Ride::with('rider', 'driver')->orderByDesc('id');
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['from'])) {
            $query->where('requested_at', '>=', \Carbon\Carbon::parse($filters['from'], 'Africa/Kigali')->startOfDay()->utc());
        }
        if (isset($filters['to'])) {
            $query->where('requested_at', '<=', \Carbon\Carbon::parse($filters['to'], 'Africa/Kigali')->endOfDay()->utc());
        }
        foreach (['rider' => 'rider_id', 'driver' => 'driver_id'] as $param => $column) {
            if (! empty($filters[$param])) {
                $query->whereIn($column, $this->usersMatching($filters[$param]));
            }
        }
        if (! empty($filters['flagged'])) {
            $query->where(fn ($q) => $q->whereNotNull('flagged_at')->orWhereIn('id', RideRating::where('stars', '<=', 2)->select('ride_id')));
        }

        $page = $query->paginate(30);

        return response()->json([
            'data'      => collect($page->items())->map(fn (Ride $r) => $this->summary($r))->values(),
            'next_page' => $page->hasMorePages() ? $page->currentPage() + 1 : null,
        ]);
    }

    /** GET /admin/rides/{id} — timeline, fare breakdown, ratings (S10.2) */
    public function show(Request $request, int $id)
    {
        $this->authorizeOps($request);

        return response()->json($this->detail($this->ride($id)));
    }

    /** POST /admin/rides/{id}/adjust {final_fare?, commission?, note} — completed rides only, logged */
    public function adjust(Request $request, int $id)
    {
        $admin = $this->authorizeOps($request);
        $ride = $this->ride($id);
        $data = $request->validate([
            'final_fare' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'commission' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'note'       => ['required', 'string', 'min:5', 'max:500'],
        ]);
        $changes = array_filter(
            ['final_fare' => $data['final_fare'] ?? null, 'commission' => $data['commission'] ?? null],
            fn ($v) => $v !== null,
        );
        if (! $changes) {
            throw ValidationException::withMessages(['final_fare' => 'Give a new final fare or commission.']);
        }
        if ($ride->status !== Ride::COMPLETED) {
            return response()->json(['message' => 'Only completed rides can be adjusted.'], 409);
        }
        $fare = $changes['final_fare'] ?? $ride->final_fare;
        if (($changes['commission'] ?? $ride->commission) > $fare) {
            throw ValidationException::withMessages(['commission' => 'Commission cannot be more than the final fare.']);
        }

        $before = ['final_fare' => $ride->final_fare, 'commission' => $ride->commission];
        DB::transaction(function () use ($ride, $changes, $before, $admin, $data) {
            $ride->forceFill($changes)->save();
            // Lower commission → the driver owes less (S7.2)
            if (array_key_exists('commission', $changes) && $ride->driver_id) {
                app(\App\Services\Payments\DriverLedger::class)->adjust($ride->driver_id, 'ride', $ride->id,
                    (int) $before['commission'] - (int) $changes['commission'], 'Commission adjusted: ' . $data['note']);
            }
            RideEvent::create([
                'ride_id' => $ride->id, 'actor_id' => $admin->id, 'type' => 'adjusted',
                'payload' => ['before' => $before, 'after' => $changes, 'note' => $data['note']],
            ]);
            ActivityLog::create([
                'admin_id'    => $admin->id,
                'action'      => 'ride.adjusted',
                'entity_type' => 'ride',
                'entity_id'   => $ride->id,
                'details'     => ['before' => $before, 'after' => $changes, 'note' => $data['note']],
            ]);
        });

        return response()->json($this->detail($ride->fresh()));
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private function authorizeOps(Request $request): User
    {
        $user = $request->user();
        abort_unless($user && $user->hasPermission('manage-rides'), 403, 'You do not have permission to manage rides.');

        return $user;
    }

    private function ride(int $id): Ride
    {
        return Ride::with('rider', 'driver', 'vehicle')->findOrFail($id);
    }

    /** User ids whose name or phone contains the search text */
    private function usersMatching(string $search)
    {
        $digits = preg_replace('/\D/', '', $search);

        return User::where('name', 'like', '%' . $search . '%')
            ->when(strlen($digits) >= 4, fn ($q) => $q->orWhere('phone', 'like', '%' . substr($digits, -9) . '%'))
            ->select('id');
    }

    private function person(?User $user): ?array
    {
        return $user ? ['id' => $user->id, 'name' => $user->name, 'phone' => $user->phone] : null;
    }

    private function summary(Ride $ride): array
    {
        return [
            'id'            => $ride->id,
            'status'        => $ride->status,
            'vehicle_class' => $ride->vehicle_class,
            'rider'         => $this->person($ride->rider),
            'driver'        => $this->person($ride->driver),
            'pickup'        => ['lat' => $ride->pickup_lat, 'lng' => $ride->pickup_lng, 'address' => $ride->pickup_address],
            'dropoff'       => ['lat' => $ride->dropoff_lat, 'lng' => $ride->dropoff_lng, 'address' => $ride->dropoff_address],
            'quoted_fare'   => $ride->quoted_fare,
            'final_fare'    => $ride->final_fare,
            'flagged'       => $ride->flagged_at !== null,
            'requested_at'  => $ride->requested_at?->toIso8601String(),
        ];
    }

    private function detail(Ride $ride): array
    {
        $names = User::whereIn('id', $ride->events()->pluck('actor_id')->filter())->pluck('name', 'id');

        return $this->summary($ride) + [
            'payment_method' => $ride->payment_method,
            'cancel_reason'  => $ride->cancel_reason,
            'cancelled_by'   => $ride->cancelled_by,
            'pin_attempts'   => $ride->pin_attempts,
            'vehicle'        => $ride->vehicle ? ['plate' => $ride->vehicle->plate, 'model' => trim($ride->vehicle->make . ' ' . $ride->vehicle->model), 'color' => $ride->vehicle->color] : null,
            'fare'           => [
                'est_distance_km' => $ride->est_distance_km,
                'est_minutes'     => $ride->est_minutes,
                'pickup_km'       => $ride->pickup_km,
                'rate'            => $ride->rate_snapshot,
                'driver_fare'     => $ride->driver_fare,
                'service_fee'     => $ride->service_fee,
                'quoted_fare'     => $ride->quoted_fare,
                'cancel_fee'      => $ride->cancel_fee,
                'commission_pct'  => $ride->commission_pct,
                'commission'      => $ride->commission,
                'final_fare'      => $ride->final_fare,
            ],
            'timeline' => $ride->events()->orderBy('id')->get()->map(fn (RideEvent $e) => [
                'type'    => $e->type,
                'actor'   => $e->actor_id ? ($names[$e->actor_id] ?? null) : 'system',
                'payload' => $e->payload,
                'at'      => $e->created_at?->toIso8601String(),
            ])->values(),
            'ratings' => $ride->ratings()->get()->map(fn (RideRating $r) => [
                'from'    => $r->from_user_id === $ride->rider_id ? 'rider' : 'driver',
                'stars'   => $r->stars,
                'tags'    => $r->tags ?? [],
                'comment' => $r->comment,
            ])->values(),
        ];
    }
}
