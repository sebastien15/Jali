<?php

namespace App\Http\Controllers;

use App\Models\DriverHire;
use App\Modules\DriverHire\Application\HirePresenter;
use App\Modules\DriverHire\Application\HireQueries;
use App\Modules\DriverHire\Application\HireService;
use Illuminate\Http\Request;

/**
 * Driver side of a hire (story S6.4). Requires offer-driver-hire; every action
 * also checks the hire belongs to this driver (404 otherwise).
 * Transport adapter for DriverHire (runbook M03-Hire).
 */
class DriverHireController extends Controller
{
    public function __construct(
        private readonly HireService $hires,
        private readonly HireQueries $queries,
    ) {
    }

    /** GET /driver/hires?scope=requests|upcoming|past */
    public function index(Request $request)
    {
        $scope = $request->validate(['scope' => 'sometimes|in:requests,upcoming,past'])['scope'] ?? 'requests';

        return response()->json($this->queries->driverHires($request->user(), $scope));
    }

    public function accept(Request $request, int $id)
    {
        return $this->respond($request, $this->hires->accept($this->hire($id), $request->user()));
    }

    public function decline(Request $request, int $id)
    {
        return $this->respond($request, $this->hires->decline($this->hire($id), $request->user()));
    }

    public function checkIn(Request $request, int $id)
    {
        $odometer = $request->validate(['odometer' => 'sometimes|nullable|integer|min:0|max:9999999'])['odometer'] ?? null;   // S13.7

        return $this->respond($request, $this->hires->checkIn($this->hire($id), $request->user(), $odometer));
    }

    public function checkOut(Request $request, int $id)
    {
        $validated = $request->validate(['payment_method' => 'required|in:cash,momo', 'odometer' => 'sometimes|nullable|integer|min:0|max:9999999']);

        return $this->respond($request, $this->hires->checkOut($this->hire($id), $request->user(), $validated['payment_method'], $validated['odometer'] ?? null));
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
