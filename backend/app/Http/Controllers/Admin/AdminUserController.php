<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Application\IdentityRequestRejected;
use App\Modules\Identity\Application\UserAdmin;
use Illuminate\Http\Request;

/** Transport adapter for Identity (M03-Remaining): validation + HTTP shape only. */
class AdminUserController extends Controller
{
    public function __construct(private readonly UserAdmin $users)
    {
    }

    public function index(Request $request)
    {
        return response()->json($this->users->list());
    }

    public function update(Request $request, $id)
    {
        // 404 for an unknown user wins over validation, as before.
        $user = $this->users->find($id);

        $data = $request->validate([
            "name" => "sometimes|string|max:100",
            "role" => "sometimes|string|exists:roles,name",
        ]);

        try {
            return response()->json($this->users->update($request->user(), $user, $data));
        } catch (IdentityRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }
}
