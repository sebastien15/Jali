<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Bus\Application\BusFleet;
use Illuminate\Http\Request;

/**
 * Transport adapter for Bus (runbook M03-Bus): validation + HTTP shape only.
 * Not referenced by routes/api.php (see docs/migration/routes-baseline.json).
 */
class AdminBusController extends Controller
{
    public function __construct(private readonly BusFleet $fleet)
    {
    }

    public function index(Request $request)
    {
        return response()->json($this->fleet->all());
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

        return response()->json($this->fleet->create($data), 201);
    }

    public function update(Request $request, $id)
    {
        $bus = $this->fleet->find($id);

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

        return response()->json($this->fleet->update($bus, $data));
    }

    public function destroy(Request $request, $id)
    {
        $this->fleet->delete($this->fleet->find($id));
        return response()->json(['message' => 'Deleted']);
    }
}
