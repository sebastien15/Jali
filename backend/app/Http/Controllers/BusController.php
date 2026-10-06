<?php

namespace App\Http\Controllers;

use App\Modules\Bus\Application\BusCatalogue;
use Illuminate\Http\Request;

/** Transport adapter for Bus (runbook M03-Bus): HTTP shape only. */
class BusController extends Controller
{
    public function __construct(private readonly BusCatalogue $catalogue)
    {
    }

    public function index(Request $request)
    {
        // Filter by from/to city when the key is sent (date is informational only).
        return response()->json($this->catalogue->buses($request->only(['from', 'to'])));
    }
}
