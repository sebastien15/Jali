<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\DriverHire\Application\AdminHires;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Hire operations for admins (S6.6), behind manage-rides. Validation + HTTP shape only. */
class AdminHireController extends Controller
{
    public function __construct(private readonly AdminHires $hires)
    {
    }

    /** GET /admin/hires?status&from&to&customer&driver&page */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'status'   => ['sometimes', Rule::in(AdminHires::STATUSES)],
            'from'     => ['sometimes', 'date'],
            'to'       => ['sometimes', 'date'],
            'customer' => ['sometimes', 'string', 'max:100'],
            'driver'   => ['sometimes', 'string', 'max:100'],
            'disputed' => ['sometimes', 'boolean'],
        ]);

        return response()->json($this->hires->search($filters));
    }

    /** GET /admin/hires/{id} */
    public function show(int $id)
    {
        return response()->json($this->hires->detail($this->hires->hire($id)));
    }

    /** POST /admin/hires/{id}/disputes/{disputeId}/resolve {resolution} — logged; both sides are told (S6.5) */
    public function resolveDispute(Request $request, int $id, int $disputeId)
    {
        $data = $request->validate(['resolution' => 'required|string|min:5|max:1000']);

        return response()->json($this->hires->resolveDispute($this->hires->hire($id), $disputeId, $request->user(), $data['resolution']));
    }

    /** POST /admin/hires/{id}/times {checked_in_at?, checked_out_at?, note} — logged */
    public function times(Request $request, int $id)
    {
        $data = $request->validate([
            'checked_in_at'  => ['sometimes', 'date'],
            'checked_out_at' => ['sometimes', 'date'],
            'note'           => ['required', 'string', 'min:5', 'max:500'],
        ]);

        return response()->json($this->hires->correctTimes($this->hires->hire($id), $request->user(), $data));
    }
}
