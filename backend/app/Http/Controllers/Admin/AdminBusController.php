<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Bus;
use Illuminate\Http\Request;

class AdminBusController extends Controller
{
    public function index(Request $request)
    {
        $buses = Bus::orderBy('agency')->orderBy('dep')->get();
        return response()->json($buses);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'agency'  => 'required|string|max:100',
            'from'    => 'required|string|max:100',
            'to'      => 'required|string|max:100',
            'dep'     => 'required|string|max:20',
            'arr'     => 'required|string|max:20',
            'price'   => 'required|integer|min:0',
            'seats'   => 'required|integer|min:1',
            'active'  => 'boolean',
        ]);

        $bus = Bus::create(array_merge($data, ['active' => $data['active'] ?? true]));
        return response()->json($bus, 201);
    }

    public function update(Request $request, $id)
    {
        $bus = Bus::findOrFail($id);

        $data = $request->validate([
            'agency'  => 'sometimes|string|max:100',
            'from'    => 'sometimes|string|max:100',
            'to'      => 'sometimes|string|max:100',
            'dep'     => 'sometimes|string|max:20',
            'arr'     => 'sometimes|string|max:20',
            'price'   => 'sometimes|integer|min:0',
            'seats'   => 'sometimes|integer|min:1',
            'active'  => 'sometimes|boolean',
        ]);

        $bus->update($data);
        return response()->json($bus);
    }

    public function destroy(Request $request, $id)
    {
        $bus = Bus::findOrFail($id);
        $bus->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
