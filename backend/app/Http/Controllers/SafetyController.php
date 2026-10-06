<?php

namespace App\Http\Controllers;

use App\Models\Ride;
use App\Services\Safety\SafetyService;
use Illuminate\Http\Request;

/** Share my trip (S8.1), SOS (S8.2) and my emergency contact */
class SafetyController extends Controller
{
    /** POST /rides/{id}/share → {url} — rider or driver of an active ride */
    public function share(Request $request, SafetyService $safety, int $id)
    {
        return response()->json(['url' => $safety->share(Ride::findOrFail($id), $request->user())]);
    }

    /** POST /rides/{id}/sos {lat?, lng?} */
    public function sos(Request $request, SafetyService $safety, int $id)
    {
        $data = $request->validate([
            'lat' => 'sometimes|nullable|numeric|between:-90,90',
            'lng' => 'sometimes|nullable|numeric|between:-180,180',
        ]);

        return response()->json($safety->sos(Ride::findOrFail($id), $request->user(),
            isset($data['lat']) ? (float) $data['lat'] : null, isset($data['lng']) ? (float) $data['lng'] : null));
    }

    /** GET /me/emergency-contact */
    public function contact(Request $request)
    {
        $user = $request->user();

        return response()->json(['name' => $user->emergency_contact_name, 'phone' => $user->emergency_contact_phone]);
    }

    /** PUT /me/emergency-contact {name, phone} */
    public function saveContact(Request $request)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:100',
            'phone' => ['required', 'string', 'regex:/^\+?[0-9 ]{9,16}$/'],
        ]);
        $request->user()->update(['emergency_contact_name' => $data['name'], 'emergency_contact_phone' => $data['phone']]);

        return response()->json($data);
    }

    /** GET /share/{token} — PUBLIC (token is the secret); 410 once the ride is over */
    public function publicShare(string $token)
    {
        $ride = Ride::where('share_token', $token)->first();
        abort_unless($ride, 404, 'This link is not valid.');
        if (!$ride->isActive()) {
            return response()->json(['message' => 'This trip has ended.', 'status' => $ride->status], 410);
        }

        return response()->json(SafetyService::publicView($ride));
    }
}
