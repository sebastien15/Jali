<?php

namespace App\Http\Controllers;

use App\Models\DriverHire;
use App\Services\Hire\HirePresenter;
use App\Services\Hire\HireService;
use Illuminate\Http\Request;

/**
 * Driver side of a hire (story S6.4). Requires offer-driver-hire; every action
 * also checks the hire belongs to this driver (404 otherwise).
 */
class DriverHireController extends Controller
{
    /** GET /driver/hires?scope=requests|upcoming|past */
    public function index(Request $request, HireService $hires)
    {
        $user = $request->user();
        $scope = $request->validate(['scope' => 'sometimes|in:requests,upcoming,past'])['scope'] ?? 'requests';

        DriverHire::where('driver_id', $user->id)->where('status', DriverHire::REQUESTED)->where('expires_at', '<', now())
            ->each(fn (DriverHire $h) => $hires->expire($h));

        $query = DriverHire::where('driver_id', $user->id);
        match ($scope) {
            'requests' => $query->where('status', DriverHire::REQUESTED)->orderBy('start_at'),
            'upcoming' => $query->whereIn('status', DriverHire::BOOKED)->orderBy('start_at'),
            'past'     => $query->whereNotIn('status', DriverHire::ACTIVE)->orderByDesc('start_at'),
        };

        return response()->json($query->limit(100)->get()->map(fn (DriverHire $h) => HirePresenter::present($h, $user))->values());
    }

    public function accept(Request $request, HireService $hires, int $id)
    {
        return $this->respond($request, $hires->accept($this->hire($id), $request->user()));
    }

    public function decline(Request $request, HireService $hires, int $id)
    {
        return $this->respond($request, $hires->decline($this->hire($id), $request->user()));
    }

    public function checkIn(Request $request, HireService $hires, int $id)
    {
        return $this->respond($request, $hires->checkIn($this->hire($id), $request->user()));
    }

    public function checkOut(Request $request, HireService $hires, int $id)
    {
        $validated = $request->validate(['payment_method' => 'required|in:cash,momo']);

        return $this->respond($request, $hires->checkOut($this->hire($id), $request->user(), $validated['payment_method']));
    }

    private function hire(int $id): DriverHire
    {
        return DriverHire::findOrFail($id);
    }

    private function respond(Request $request, DriverHire $hire)
    {
        return response()->json(HirePresenter::present($hire, $request->user()));
    }
}
