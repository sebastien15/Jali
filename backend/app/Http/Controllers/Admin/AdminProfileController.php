<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->auth_user;
        $user->load("location");

        return response()->json([
            "id" => $user->id,
            "name" => $user->name,
            "email" => $user->email,
            "phone" => $user->phone,
            "whatsapp_number" => $user->whatsapp_number,
            "profile_image_url" => $user->profile_image_url,
            "contract_doc_url" => $user->contract_doc_url,
            "contract_verified" => $user->contract_verified,
            "location" => $user->location,
            "roles" => $user->roles->pluck("name"),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->auth_user;

        $data = $request->validate([
            "phone" => "nullable|string|max:20",
            "whatsapp_number" => "nullable|string|max:20",
        ]);

        $user->update($data);

        ActivityLog::create([
            "admin_id" => $user->id,
            "action" => "profile_updated",
            "entity_type" => "user",
            "entity_id" => $user->id,
            "details" => ["fields" => array_keys($data)],
        ]);

        return response()->json($user->fresh());
    }

    public function uploadProfileImage(Request $request)
    {
        $user = $request->auth_user;

        $request->validate([
            "image" => "required|image|max:5120", // 5MB
        ]);

        $path = $request->file("image")->store("profile-images", "public");
        $url = Storage::url($path);

        $user->update(["profile_image_url" => $url]);

        ActivityLog::create([
            "admin_id" => $user->id,
            "action" => "profile_image_uploaded",
            "entity_type" => "user",
            "entity_id" => $user->id,
            "details" => ["url" => $url],
        ]);

        return response()->json(["profile_image_url" => $url]);
    }

    public function uploadContract(Request $request)
    {
        $user = $request->auth_user;

        $request->validate([
            "contract" => "required|file|mimes:pdf|max:10240", // 10MB
        ]);

        $path = $request->file("contract")->store("contracts", "public");
        $url = Storage::url($path);

        $user->update([
            "contract_doc_url" => $url,
            "contract_verified" => false, // Reset verification on new upload
        ]);

        ActivityLog::create([
            "admin_id" => $user->id,
            "action" => "contract_uploaded",
            "entity_type" => "user",
            "entity_id" => $user->id,
            "details" => ["url" => $url],
        ]);

        return response()->json(["contract_doc_url" => $url]);
    }
}
