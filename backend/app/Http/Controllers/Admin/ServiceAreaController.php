<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServiceArea;
use App\Modules\Locations\Application\ServiceAreaAdmin;
use Illuminate\Http\Request;

/** Transport adapter for service areas and zones (S10.4): validation + HTTP shape only. */
class ServiceAreaController extends Controller
{
    public function __construct(private readonly ServiceAreaAdmin $areas)
    {
    }

    /** GET /admin/service-areas */
    public function index()
    {
        return response()->json(['data' => $this->areas->list()]);
    }

    /** POST /admin/service-areas */
    public function store(Request $request)
    {
        $area = $this->areas->create($request->validate(ServiceAreaAdmin::rules(true)), $request->user());

        return response()->json(ServiceAreaAdmin::present($area->fresh('parent')), 201);
    }

    /** GET /admin/service-areas/{id} */
    public function show(int $id)
    {
        return response()->json(ServiceAreaAdmin::present(ServiceArea::with('parent')->findOrFail($id)));
    }

    /** PUT /admin/service-areas/{id} */
    public function update(Request $request, int $id)
    {
        $area = ServiceArea::findOrFail($id);
        $area = $this->areas->update($area, $request->validate(ServiceAreaAdmin::rules(false)), $request->user());

        return response()->json(ServiceAreaAdmin::present($area->fresh('parent')));
    }

    /** DELETE /admin/service-areas/{id} */
    public function destroy(Request $request, int $id)
    {
        $this->areas->delete(ServiceArea::findOrFail($id), $request->user());

        return response()->noContent();
    }
}
