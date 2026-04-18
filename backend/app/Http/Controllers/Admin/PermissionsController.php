<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Permission;

class PermissionsController extends Controller
{
    public function index()
    {
        return response()->json(
            Permission::orderBy('category')->orderBy('name')->get(['id', 'name', 'description', 'category'])
        );
    }
}
