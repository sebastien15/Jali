<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Application\RoleAdmin;

/** Transport adapter for Identity (M03-Remaining). */
class PermissionsController extends Controller
{
    public function index(RoleAdmin $roles)
    {
        return response()->json($roles->permissionCatalogue());
    }
}
