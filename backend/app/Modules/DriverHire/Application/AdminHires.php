<?php

namespace App\Modules\DriverHire\Application;

use App\Models\ActivityLog;
use App\Models\DriverHire;
use App\Models\HireRating;
use App\Models\User;
use App\Modules\Payments\Contracts\MoneyRecorder;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Hire operations for admins (S6.6): search, detail with timeline, quote
 * snapshot and ratings, and logged corrections of check-in/check-out times.
 */
class AdminHires
{
    public const STATUSES = [
        DriverHire::REQUESTED, DriverHire::ACCEPTED, DriverHire::STARTED, DriverHire::COMPLETED,
        DriverHire::DECLINED, DriverHire::EXPIRED, DriverHire::CANCELLED_BY_CUSTOMER, DriverHire::CANCELLED_BY_DRIVER,
    ];

    public function __construct(private MoneyRecorder $money)
    {
    }

    /** Filters already validated: status, from, to (start date, Kigali), customer, driver */
    public function search(array $filters): array
    {
        $query = DriverHire::with('customer', 'driver')->orderByDesc('start_at')->orderByDesc('id');
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['from'])) {
            $query->where('start_at', '>=', Carbon::parse($filters['from'], 'Africa/Kigali')->startOfDay()->utc());
        }
        if (isset($filters['to'])) {
            $query->where('start_at', '<=', Carbon::parse($filters['to'], 'Africa/Kigali')->endOfDay()->utc());
        }
        foreach (['customer' => 'customer_id', 'driver' => 'driver_id'] as $param => $column) {
            if (!empty($filters[$param])) {
                $query->whereIn($column, self::usersMatching($filters[$param]));
            }
        }
        $page = $query->paginate(30);

        return [
            'data'      => collect($page->items())->map(fn (DriverHire $h) => self::summary($h))->values()->all(),
            'next_page' => $page->hasMorePages() ? $page->currentPage() + 1 : null,
        ];
    }

    public function hire(int $id): DriverHire
    {
        return DriverHire::with('customer', 'driver')->findOrFail($id);
    }

    public function detail(DriverHire $hire): array
    {
        $events = [
            ['type' => 'requested', 'at' => $hire->requested_at, 'actor' => $hire->customer?->name],
            ['type' => 'accepted', 'at' => $hire->accepted_at, 'actor' => $hire->driver?->name],
            ['type' => 'checked_in', 'at' => $hire->checked_in_at, 'actor' => $hire->driver?->name],
            ['type' => 'checked_out', 'at' => $hire->checked_out_at, 'actor' => $hire->driver?->name],
            ['type' => $hire->status, 'at' => $hire->cancelled_at, 'actor' => $hire->cancelled_by],
        ];
        $timeline = collect($events)->filter(fn ($e) => $e['at'] !== null)
            ->map(fn ($e) => ['type' => $e['type'], 'actor' => $e['actor'], 'note' => null, 'at' => $e['at']->toIso8601String()]);
        $admins = ActivityLog::where('entity_type', 'driver_hire')->where('entity_id', $hire->id)->with('admin:id,name')->get()
            ->map(fn (ActivityLog $l) => ['type' => $l->action, 'actor' => $l->admin?->name, 'note' => $l->details['note'] ?? null,
                'at' => $l->created_at?->toIso8601String()]);

        return self::summary($hire) + [
            'duration'        => ['type' => $hire->duration_type, 'value' => $hire->duration_value],
            'trip_type'       => $hire->trip_type,
            'transmission'    => $hire->transmission,
            'pickup'          => ['lat' => (float) $hire->pickup_lat, 'lng' => (float) $hire->pickup_lng, 'address' => $hire->pickup_address],
            'car_description' => $hire->car_description,
            'notes'           => $hire->notes,
            'payment_method'  => $hire->payment_method,
            'cancel_reason'   => $hire->cancel_reason,
            'cancelled_by'    => $hire->cancelled_by,
            'checked_in_at'   => $hire->checked_in_at?->toIso8601String(),
            'checked_out_at'  => $hire->checked_out_at?->toIso8601String(),
            'quote' => [
                'rate'             => $hire->rate_snapshot,
                'driver_total'     => $hire->driver_total,
                'service_fee'      => $hire->service_fee,
                'quoted_total'     => $hire->quoted_total,
                'overtime_minutes' => $hire->overtime_minutes,
                'overtime_amount'  => $hire->overtime_amount,
                'final_total'      => $hire->final_total,
                'commission_pct'   => (float) $hire->commission_pct,
                'commission'       => $hire->commission,
                'cancel_fee'       => $hire->cancel_fee,
            ],
            'timeline' => $timeline->concat($admins)->sortBy('at')->values()->all(),
            'ratings'  => $hire->ratings()->get()->map(fn (HireRating $r) => [
                'from' => $r->from_user_id == $hire->customer_id ? 'customer' : 'driver',
                'stars' => $r->stars, 'tags' => $r->tags ?? [], 'comment' => $r->comment,
            ])->values()->all(),
        ];
    }

    /**
     * Correct check-in/check-out with a note (S6.6). A completed hire gets its
     * overtime, total and commission recomputed; the driver's balance follows.
     */
    public function correctTimes(DriverHire $hire, User $admin, array $data): array
    {
        if (!in_array($hire->status, [DriverHire::STARTED, DriverHire::COMPLETED], true)) {
            throw new HttpException(409, 'Only started or completed hires have times to correct.');
        }
        $in = isset($data['checked_in_at']) ? Carbon::parse($data['checked_in_at'])->utc() : $hire->checked_in_at;
        $out = isset($data['checked_out_at']) ? Carbon::parse($data['checked_out_at'])->utc() : $hire->checked_out_at;
        if (!isset($data['checked_in_at']) && !isset($data['checked_out_at'])) {
            throw ValidationException::withMessages(['checked_in_at' => 'Give a new check-in or check-out time.']);
        }
        if ($out && !$in) {
            throw ValidationException::withMessages(['checked_in_at' => 'Set the check-in time too.']);
        }
        if ($in && $out && $out->lte($in)) {
            throw ValidationException::withMessages(['checked_out_at' => 'Check-out must be after check-in.']);
        }
        if ($out && $hire->status !== DriverHire::COMPLETED) {
            throw ValidationException::withMessages(['checked_out_at' => 'This hire has not been checked out yet.']);
        }

        $before = self::times($hire);
        $changes = ['checked_in_at' => $in, 'checked_out_at' => $out];
        if ($hire->status === DriverHire::COMPLETED) {
            $overtime = HireQuote::overtime($hire->rate_snapshot, $hire->start_at, $hire->end_at, $in ?? $hire->start_at, $out);
            $changes += [
                'overtime_minutes' => $overtime['minutes'],
                'overtime_amount'  => $overtime['amount'],
                'final_total'      => $hire->quoted_total + $overtime['amount'],
                'commission'       => (int) round(($hire->driver_total + $overtime['amount']) * $hire->commission_pct / 100),
            ];
        }

        DB::transaction(function () use ($hire, $admin, $data, $before, $changes) {
            $oldCommission = (int) $hire->commission;
            $hire->forceFill($changes)->save();
            if ($hire->status === DriverHire::COMPLETED && $oldCommission !== (int) $hire->commission) {
                // Less commission owed → credit; more → debit (S7.2)
                $this->money->adjust($hire->driver_id, 'hire', $hire->id, $oldCommission - (int) $hire->commission, 'Hire times corrected: ' . $data['note']);
            }
            ActivityLog::create([
                'admin_id' => $admin->id, 'action' => 'hire.times_corrected', 'entity_type' => 'driver_hire', 'entity_id' => $hire->id,
                'details'  => ['before' => $before, 'after' => self::times($hire), 'note' => $data['note']],
            ]);
        });

        return $this->detail($hire->fresh(['customer', 'driver']));
    }

    private static function times(DriverHire $h): array
    {
        return ['checked_in_at' => $h->checked_in_at?->toIso8601String(), 'checked_out_at' => $h->checked_out_at?->toIso8601String(),
            'overtime_minutes' => $h->overtime_minutes, 'final_total' => $h->final_total, 'commission' => $h->commission];
    }

    private static function usersMatching(string $search)
    {
        $digits = preg_replace('/\D/', '', $search);

        return User::where('name', 'like', '%' . $search . '%')
            ->when(strlen($digits) >= 4, fn ($q) => $q->orWhere('phone', 'like', '%' . substr($digits, -9) . '%'))
            ->select('id');
    }

    private static function person(?User $u): ?array
    {
        return $u ? ['id' => $u->id, 'name' => $u->name, 'phone' => $u->phone] : null;
    }

    public static function summary(DriverHire $h): array
    {
        return [
            'id'           => $h->id,
            'status'       => $h->status,
            'customer'     => self::person($h->customer),
            'driver'       => self::person($h->driver),
            'start_at'     => $h->start_at?->toIso8601String(),
            'end_at'       => $h->end_at?->toIso8601String(),
            'quoted_total' => $h->quoted_total,
            'final_total'  => $h->final_total,
            'requested_at' => $h->requested_at?->toIso8601String(),
        ];
    }
}
