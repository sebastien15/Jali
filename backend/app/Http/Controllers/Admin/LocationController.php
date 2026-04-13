<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LocationController extends Controller
{
    public function index(Request $request)
    {
        $query = Location::query();

        if ($request->has("type")) {
            $query->where("type", $request->type);
        }
        if ($request->has("city")) {
            $query->where("city", $request->city);
        }

        $locations = $query->orderBy("city")->orderBy("name")->get();

        // Enrich each location with its province, corridors, and agencies
        $names = $locations->pluck('name')->toArray();

        $rows = DB::table('admin_stations as st')
            ->join('corridor_terminals as ct', 'ct.terminal_id', '=', 'st.id')
            ->join('corridors as c', 'c.id', '=', 'ct.corridor_id')
            ->leftJoin('agency_routes as ar', 'ar.corridor_id', '=', 'c.id')
            ->leftJoin('agencies as a', 'a.id', '=', 'ar.agency_id')
            ->whereIn('st.name', $names)
            ->select(
                'st.name as terminal_name',
                'st.province',
                'c.id as corridor_id',
                'c.code',
                'c.name as corridor_name',
                'c.description as corridor_description',
                'ct.stop_order',
                'a.id as agency_id',
                'a.name as agency_name'
            )
            ->orderBy('st.name')
            ->orderBy('c.code')
            ->orderBy('a.name')
            ->get();

        // Group: terminal name → corridors → agencies
        $terminalData = [];
        foreach ($rows as $row) {
            $tn = $row->terminal_name;
            if (!isset($terminalData[$tn])) {
                $terminalData[$tn] = ['province' => $row->province, 'corridors' => []];
            }
            $cid = $row->corridor_id;
            if (!isset($terminalData[$tn]['corridors'][$cid])) {
                $terminalData[$tn]['corridors'][$cid] = [
                    'code'        => $row->code,
                    'name'        => $row->corridor_name,
                    'description' => $row->corridor_description,
                    'stop_order'  => $row->stop_order,
                    'agencies'    => [],
                ];
            }
            if ($row->agency_id) {
                $terminalData[$tn]['corridors'][$cid]['agencies'][$row->agency_id] = $row->agency_name;
            }
        }

        $enriched = $locations->map(function ($loc) use ($terminalData) {
            $data = $terminalData[$loc->name] ?? null;
            $corridors = [];
            if ($data) {
                foreach ($data['corridors'] as $c) {
                    $corridors[] = [
                        'code'        => $c['code'],
                        'name'        => $c['name'],
                        'description' => $c['description'],
                        'stop_order'  => $c['stop_order'],
                        'agencies'    => array_values($c['agencies']),
                    ];
                }
                usort($corridors, fn($a, $b) => strcmp($a['code'], $b['code']));
            }
            return array_merge($loc->toArray(), [
                'province'  => $data['province'] ?? null,
                'corridors' => $corridors,
            ]);
        });

        return response()->json($enriched);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            "name" => "required|string|max:255",
            "type" => "required|in:bus_station,custom",
            "city" => "required|string|max:255",
            "address" => "nullable|string|max:500",
            "latitude" => "nullable|numeric",
            "longitude" => "nullable|numeric",
        ]);

        $location = Location::create($data);
        return response()->json($location, 201);
    }

    public function update(Request $request, $id)
    {
        $location = Location::findOrFail($id);

        $data = $request->validate([
            "name" => "sometimes|string|max:255",
            "type" => "sometimes|in:bus_station,custom",
            "city" => "sometimes|string|max:255",
            "address" => "nullable|string|max:500",
            "latitude" => "nullable|numeric",
            "longitude" => "nullable|numeric",
        ]);

        $location->update($data);
        return response()->json($location);
    }

    public function destroy($id)
    {
        $location = Location::findOrFail($id);

        // Check if any admin is assigned here
        if ($location->admins()->exists()) {
            return response()->json(
                [
                    "error" =>
                        "Cannot delete: admins are assigned to this location.",
                ],
                422,
            );
        }

        // Check if any bookings reference this location
        if ($location->bookings()->exists()) {
            return response()->json(
                [
                    "error" =>
                        "Cannot delete: bookings reference this location.",
                ],
                422,
            );
        }

        $location->delete();
        return response()->json(["message" => "Location deleted."]);
    }
}
