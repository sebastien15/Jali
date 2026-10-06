<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Bus\Application\BusRequestRejected;
use App\Modules\Bus\Application\StationDirectory;
use Illuminate\Http\Request;

/** Transport adapter for Bus (runbook M03-Bus): validation + HTTP shape only. */
class AdminStationController extends Controller
{
    public function __construct(private readonly StationDirectory $stations)
    {
    }

    public function index(Request $request)
    {
        // The public /stations list is used by passengers' station picker:
        // only manage-admins callers see which staff member runs a station.
        return response()->json($this->stations->list($request->user()->hasPermission('manage-admins')));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'city'      => 'required|string|max:100',
            'district'  => 'nullable|string|max:100',
            'type'      => 'sometimes|in:bus_station,custom',
            'address'   => 'nullable|string|max:300',
            'latitude'  => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'image_url' => 'nullable|string|max:500',
            'admin_id'  => 'nullable|integer|exists:users,id',
            'name'      => 'sometimes|nullable|string|max:150',
            'province'  => 'sometimes|nullable|string|max:100',
            'aliases'   => 'sometimes|nullable|array|max:20',
            'aliases.*' => 'string|max:100',
        ]);

        return response()->json($this->stations->create($data), 201);
    }

    public function update(Request $request, $id)
    {
        $station = $this->stations->find($id);

        $data = $request->validate([
            'city'      => 'sometimes|string|max:100',
            'district'  => 'nullable|string|max:100',
            'type'      => 'sometimes|in:bus_station,custom',
            'address'   => 'nullable|string|max:300',
            'latitude'  => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'image_url' => 'nullable|string|max:500',
            'admin_id'  => 'nullable|integer|exists:users,id',
            'name'      => 'sometimes|nullable|string|max:150',
            'province'  => 'sometimes|nullable|string|max:100',
            'aliases'   => 'sometimes|nullable|array|max:20',
            'aliases.*' => 'string|max:100',
        ]);

        return response()->json($this->stations->update($station, $data));
    }

    public function destroy($id)
    {
        try {
            $this->stations->delete($id);
        } catch (BusRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }

        return response()->json(['message' => 'Station removed.']);
    }
}
