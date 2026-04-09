<?php

namespace App\Http\Controllers;

use App\Models\Bus;
use Illuminate\Http\Request;

class BusController extends Controller
{
    public function index(Request $request)
    {
        $query = Bus::query()->where('active', true);

        // Filter by from city
        if ($request->has('from')) {
            $query->where('from', $request->from);
        }

        // Filter by to city
        if ($request->has('to')) {
            $query->where('to', $request->to);
        }

        // Date filter (buses run daily, so this is informational only)
        // Can be used for future scheduling if needed

        $buses = $query->orderBy('dep')->get();

        return response()->json($buses);
    }
}
