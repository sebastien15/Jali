<?php

namespace App\Modules\DriverHire\Application;

use App\Models\DriverHire;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Hire reads for each side. Overdue requests are expired before they are
 * shown, so nobody sees a stale "requested" hire (story S6.4).
 */
class HireQueries
{
    public function __construct(private HireService $hires)
    {
    }

    /** GET /driver-hire — the customer's own hires, newest first, 20 per page */
    public function customerPage(User $customer): array
    {
        $page = DriverHire::where('customer_id', $customer->id)->orderByDesc('id')->paginate(20);
        collect($page->items())->each(fn (DriverHire $h) => $this->hires->expireIfLate($h));

        return [
            'data'      => collect($page->items())->map(fn (DriverHire $h) => HirePresenter::present($h, $customer))->values(),
            'next_page' => $page->hasMorePages() ? $page->currentPage() + 1 : null,
        ];
    }

    /** A hire the user is the customer or driver of; 404 for anyone else */
    public function participantHire(User $user, int $id): DriverHire
    {
        $hire = DriverHire::find($id);
        abort_unless($hire && $hire->involves($user), 404, 'Hire not found.');

        return $hire;
    }

    /** GET /driver/hires?scope=requests|upcoming|past — presented, at most 100 */
    public function driverHires(User $driver, string $scope): Collection
    {
        $this->hires->expireOverdue($driver->id);

        $query = DriverHire::where('driver_id', $driver->id);
        match ($scope) {
            'requests' => $query->where('status', DriverHire::REQUESTED)->orderBy('start_at'),
            'upcoming' => $query->whereIn('status', DriverHire::BOOKED)->orderBy('start_at'),
            'past'     => $query->whereNotIn('status', DriverHire::ACTIVE)->orderByDesc('start_at'),
        };

        return $query->limit(100)->get()->map(fn (DriverHire $h) => HirePresenter::present($h, $driver))->values();
    }
}
