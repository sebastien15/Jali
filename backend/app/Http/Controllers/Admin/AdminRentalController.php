<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CarRental;
use App\Models\RentalBooking;
use App\Modules\Rentals\Application\OwnerFleet;
use App\Modules\Rentals\Application\RentalBookingPresenter;
use App\Modules\Rentals\Application\RentalVerification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/** Rental car verification (S24.8) and rental operations (S24.9). Requires manage-rentals. */
class AdminRentalController extends Controller
{
    public function __construct(private RentalVerification $verification, private OwnerFleet $fleet)
    {
    }

    /** GET /admin/rental-cars?status=pending|verified|rejected */
    public function cars(Request $request)
    {
        $this->authorizeRentals($request);
        $status = $request->validate(['status' => ['nullable', Rule::in([CarRental::PENDING, CarRental::VERIFIED, CarRental::REJECTED])]])['status'] ?? CarRental::PENDING;

        return response()->json(['data' => $this->verification->queue($status)->map(fn ($car) => RentalVerification::present($car))->values()]);
    }

    /** GET /admin/rental-cars/{id} */
    public function car(Request $request, int $id)
    {
        $this->authorizeRentals($request);

        return response()->json(RentalVerification::present(CarRental::with('owner')->findOrFail($id)));
    }

    /** POST /admin/rental-cars/{id}/review {decision: approve|reject, note} */
    public function review(Request $request, int $id)
    {
        $admin = $this->authorizeRentals($request);
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'note'     => ['required_if:decision,reject', 'nullable', 'string', 'max:500'],
        ]);
        $car = $this->verification->review($admin, CarRental::with('owner')->findOrFail($id), $data['decision'], $data['note'] ?? null);

        return response()->json(RentalVerification::present($car));
    }

    /** GET /admin/rental-cars/{id}/documents/{type} */
    public function document(Request $request, int $id, string $type)
    {
        $admin = $this->authorizeRentals($request);
        $car = CarRental::findOrFail($id);

        return response()->file(Storage::disk('local')->path($this->fleet->readableDocumentPath($admin, $car, $type)));
    }

    /** GET /admin/rentals?status&page */
    public function rentals(Request $request)
    {
        $admin = $this->authorizeRentals($request);
        $status = $request->validate(['status' => ['nullable', Rule::in([
            RentalBooking::REQUESTED, RentalBooking::ACCEPTED, RentalBooking::ACTIVE, RentalBooking::COMPLETED,
            RentalBooking::DECLINED, RentalBooking::EXPIRED, RentalBooking::CANCELLED,
        ])]])['status'] ?? null;
        $page = RentalBooking::with('car', 'customer', 'owner')->when($status, fn ($q) => $q->where('status', $status))
            ->orderByDesc('id')->paginate(30);

        return response()->json([
            'data'      => collect($page->items())->map(fn ($b) => RentalBookingPresenter::for($b, $admin, 'admin'))->values(),
            'next_page' => $page->hasMorePages() ? $page->currentPage() + 1 : null,
        ]);
    }

    /** GET /admin/rentals/{id} */
    public function rental(Request $request, int $id)
    {
        $admin = $this->authorizeRentals($request);

        return response()->json(RentalBookingPresenter::for(RentalBooking::findOrFail($id), $admin, 'admin'));
    }

    private function authorizeRentals(Request $request)
    {
        $user = $request->user();
        abort_unless($user && $user->hasPermission('manage-rentals'), 403, 'You do not have permission to manage rentals.');

        return $user;
    }
}
