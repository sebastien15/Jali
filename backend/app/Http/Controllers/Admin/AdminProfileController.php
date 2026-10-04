<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
        $user->load(["location", "role.permissions"]);

        $station = \App\Models\AdminStation::where('user_id', $user->id)->first();

        // Earnings for cashout display — 50% of service fees on delivered bookings
        $totalEarnings = CashoutController::earnedBy($user);

        return response()->json([
            "id" => $user->id,
            "name" => $user->name,
            "email" => $user->email,
            "phone" => $user->phone,
            "whatsapp_number" => $user->whatsapp_number,
            "profile_image_url" => $user->profile_image_url,
            "contract_doc_url" => $user->contract_doc_url,
            "contract_verified" => $user->contract_verified,
            "cashout_method" => $user->cashout_method,
            "cashout_account_number" => $user->cashout_account_number,
            "cashout_account_name" => $user->cashout_account_name,
            "cashout_bank_name" => $user->cashout_bank_name,
            "total_earnings" => (float) $totalEarnings,
            "available_balance" => CashoutController::availableFor($user),
            "location" => $user->location,
            "assigned_station" => $station ? [
                "id"   => $station->id,
                "city" => $station->city,
                "district" => $station->district,
            ] : null,
            "roles" => $user->role ? $user->role->name : "user",
            "permissions" => $user->role
                ? $user->role->permissions->pluck("name")->toArray()
                : [],
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

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
        $user = $request->user();

        $request->validate([
            // Stored inline, so keep it small (the app sends ~20 KB 200×200 JPEGs).
            // Raster formats only: an SVG data URI can carry script on web.
            'image_base64' => ['required', 'string', 'max:307200', function ($attr, $value, $fail) {
                if (!preg_match('#^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$#', $value)) {
                    $fail('Invalid image data.');
                }
            }],
        ]);

        $dataUri = $request->input('image_base64');

        $user->update(['profile_image_url' => $dataUri]);

        ActivityLog::create([
            'admin_id'    => $user->id,
            'action'      => 'profile_image_uploaded',
            'entity_type' => 'user',
            'entity_id'   => $user->id,
            'details'     => ['source' => 'base64'],
        ]);

        return response()->json(['profile_image_url' => $dataUri]);
    }

    public function contractTemplate()
    {
        $url = env('CONTRACT_TEMPLATE_URL');
        if (!$url) {
            return response()->json(['message' => 'Template not configured.'], 404);
        }
        return redirect($url);
    }

    public function uploadContract(Request $request)
    {
        $user = $request->user();

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
