<?php

namespace App\Http\Controllers;

use App\Modules\Safety\Application\EmergencyContacts;
use App\Modules\Safety\Application\SafetyService;
use App\Modules\Safety\Application\TripShareEnded;
use Illuminate\Http\Request;

/**
 * Share my trip (S8.1), SOS (S8.2) and my emergency contact.
 * Transport adapter for Safety (M03-Remaining): validation + HTTP shape only.
 */
class SafetyController extends Controller
{
    /** POST /rides/{id}/share → {url} — rider or driver of an active ride */
    public function share(Request $request, SafetyService $safety, int $id)
    {
        return response()->json(['url' => $safety->share($safety->ride($id), $request->user())]);
    }

    /** POST /rides/{id}/sos {lat?, lng?} */
    public function sos(Request $request, SafetyService $safety, int $id)
    {
        $data = $request->validate([
            'lat' => 'sometimes|nullable|numeric|between:-90,90',
            'lng' => 'sometimes|nullable|numeric|between:-180,180',
        ]);

        return response()->json($safety->sos($safety->ride($id), $request->user(),
            isset($data['lat']) ? (float) $data['lat'] : null, isset($data['lng']) ? (float) $data['lng'] : null));
    }

    /** GET /me/emergency-contact */
    public function contact(Request $request, EmergencyContacts $contacts)
    {
        return response()->json($contacts->of($request->user()));
    }

    /** PUT /me/emergency-contact {name, phone} */
    public function saveContact(Request $request, EmergencyContacts $contacts)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:100',
            'phone' => ['required', 'string', 'regex:/^\+?[0-9 ]{9,16}$/'],
        ]);
        $contacts->save($request->user(), $data);

        return response()->json($data);
    }

    /** GET /share/{token} — PUBLIC (token is the secret); 410 once the ride is over */
    public function publicShare(SafetyService $safety, string $token)
    {
        try {
            return response()->json($safety->sharedTrip($token));
        } catch (TripShareEnded $e) {
            return response()->json(['message' => 'This trip has ended.', 'status' => $e->status], 410);
        }
    }
}
