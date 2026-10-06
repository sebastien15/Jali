<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\ServiceAccess\Application\ServiceCatalogue;
use Illuminate\Http\Request;

/** Release flags per service (S23.1): validation + HTTP shape only. */
class ServiceCatalogueController extends Controller
{
    /** GET /admin/services */
    public function show()
    {
        return response()->json(ServiceCatalogue::get());
    }

    /** PUT /admin/services — partial; every change is logged */
    public function update(Request $request)
    {
        $validated = $request->validate(ServiceCatalogue::rules(), ServiceCatalogue::messages());

        return response()->json(ServiceCatalogue::update($validated, $request->user()));
    }
}
