<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminStation;
use Illuminate\Http\Request;

class AdminStationController extends Controller
{
    private function format(AdminStation $s): array
    {
        $s->loadMissing('user');
        return [
            'id'          => $s->id,
            'name'        => $s->name,
            'aliases'     => $s->aliases ?? [],
            'city'        => $s->city,
            'province'    => $s->province,
            'district'    => $s->district,
            'type'        => $s->type ?? 'bus_station',
            'address'     => $s->address,
            'latitude'    => $s->latitude,
            'longitude'   => $s->longitude,
            'image_url'   => $s->image_url,
            'admin_id'    => $s->user_id,
            'admin_name'  => $s->user?->name,
            'admin_email' => $s->user?->email,
        ];
    }

    public function index(Request $request)
    {
        $stations = AdminStation::with('user')->get()->map(fn($s) => $this->format($s));
        return response()->json($stations);
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
        ]);

        $station = AdminStation::create([
            'city'      => $data['city'],
            'district'  => $data['district'] ?? null,
            'type'      => $data['type'] ?? 'bus_station',
            'address'   => $data['address'] ?? null,
            'latitude'  => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'image_url' => $data['image_url'] ?? null,
            'user_id'   => $data['admin_id'] ?? null,
        ]);

        return response()->json($this->format($station), 201);
    }

    public function update(Request $request, $id)
    {
        $station = AdminStation::findOrFail($id);

        $data = $request->validate([
            'city'      => 'sometimes|string|max:100',
            'district'  => 'nullable|string|max:100',
            'type'      => 'sometimes|in:bus_station,custom',
            'address'   => 'nullable|string|max:300',
            'latitude'  => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'image_url' => 'nullable|string|max:500',
            'admin_id'  => 'nullable|integer|exists:users,id',
        ]);

        $station->update([
            'city'      => $data['city']      ?? $station->city,
            'district'  => array_key_exists('district', $data)  ? $data['district']  : $station->district,
            'type'      => $data['type']      ?? $station->type,
            'address'   => array_key_exists('address', $data)   ? $data['address']   : $station->address,
            'latitude'  => array_key_exists('latitude', $data)  ? $data['latitude']  : $station->latitude,
            'longitude' => array_key_exists('longitude', $data) ? $data['longitude'] : $station->longitude,
            'image_url' => array_key_exists('image_url', $data) ? $data['image_url'] : $station->image_url,
            'user_id'   => array_key_exists('admin_id', $data)  ? $data['admin_id']  : $station->user_id,
        ]);

        return response()->json($this->format($station));
    }

    public function destroy($id)
    {
        $station = AdminStation::findOrFail($id);
        $station->delete();
        return response()->json(['message' => 'Station removed.']);
    }
}
