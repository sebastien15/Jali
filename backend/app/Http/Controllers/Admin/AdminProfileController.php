<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Application\AdminProfile;
use Illuminate\Http\Request;

/** Transport adapter for Identity (M03-Remaining): validation + HTTP shape only. */
class AdminProfileController extends Controller
{
    public function __construct(private readonly AdminProfile $profile)
    {
    }

    public function show(Request $request)
    {
        return response()->json($this->profile->show($request->user()));
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            "phone" => "nullable|string|max:20",
            "whatsapp_number" => "nullable|string|max:20",
        ]);

        return response()->json($this->profile->update($request->user(), $data));
    }

    public function uploadProfileImage(Request $request)
    {
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
        $this->profile->setProfileImage($request->user(), $dataUri);

        return response()->json(['profile_image_url' => $dataUri]);
    }

    public function contractTemplate()
    {
        $url = $this->profile->contractTemplateUrl();
        if (!$url) {
            return response()->json(['message' => 'Template not configured.'], 404);
        }
        return redirect($url);
    }

    public function uploadContract(Request $request)
    {
        $request->validate([
            "contract" => "required|file|mimes:pdf|max:10240", // 10MB
        ]);

        $url = $this->profile->storeContract($request->user(), $request->file("contract"));

        return response()->json(["contract_doc_url" => $url]);
    }
}
