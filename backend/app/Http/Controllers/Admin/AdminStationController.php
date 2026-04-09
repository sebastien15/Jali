<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminStation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminStationController extends Controller
{
    public function index(Request $request)
    {
        $stations = AdminStation::with('user')->get()->map(function ($s) {
            return [
                'id'         => $s->id,
                'city'       => $s->city,
                'admin_id'   => $s->user_id,
                'admin_name' => $s->user?->name,
                'admin_email'=> $s->user?->email,
            ];
        });

        return response()->json($stations);
    }

    public function update(Request $request, $id)
    {
        $station = AdminStation::findOrFail($id);

        $data = $request->validate([
            'city'     => 'sometimes|string|max:100',
            'admin_id' => 'sometimes|integer|exists:users,id',
        ]);

        if (isset($data['admin_id'])) {
            $station->update(['user_id' => $data['admin_id']]);
        }
        if (isset($data['city'])) {
            $station->update(['city' => $data['city']]);
        }

        $station->load('user');
        return response()->json([
            'id'          => $station->id,
            'city'        => $station->city,
            'admin_id'    => $station->user_id,
            'admin_name'  => $station->user?->name,
            'admin_email' => $station->user?->email,
        ]);
    }
}
