<?php

namespace App\Http\Controllers;

use App\Models\DriverDocument;
use App\Modules\Providers\Application\DriverApplication;
use App\Modules\Providers\Application\ProviderRequestRejected;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * "Become a driver" (story S1.1) and driver documents (story S1.2).
 * Open to every signed-in user (permission apply-as-driver).
 * Transport adapter for Providers (M03-Remaining): validation + HTTP shape only.
 */
class DriverOnboardingController extends Controller
{
    public function __construct(private readonly DriverApplication $application)
    {
    }

    /** GET /driver/onboarding */
    public function show(Request $request)
    {
        return response()->json($this->application->payload($request->user()));
    }

    /** PUT /driver/onboarding/services */
    public function services(Request $request)
    {
        $validated = $request->validate([
            'services'   => 'required|array|min:1',
            'services.*' => 'string|distinct|in:ride,hire,private_seat,rental',
        ]);

        return response()->json($this->application->chooseServices($request->user(), $validated['services']));
    }

    /** PUT /driver/onboarding/licence */
    public function licence(Request $request)
    {
        $validated = $request->validate([
            'licence_no'           => 'required|string|max:50',
            'licence_categories'   => 'required|array|min:1',
            'licence_categories.*' => ['string', 'distinct', Rule::in(DriverApplication::LICENCE_CATEGORIES)],
            'licence_expiry'       => 'required|date_format:Y-m-d|after:today',
            'national_id_no'       => 'sometimes|nullable|string|max:50',
        ], [
            'licence_expiry.after' => 'Your driving licence has expired. Renew it before applying.',
        ]);

        return response()->json($this->application->saveLicence($request->user(), $validated));
    }

    /** POST /driver/onboarding/submit */
    public function submit(Request $request)
    {
        try {
            return response()->json($this->application->submit($request->user()));
        } catch (ProviderRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    /** POST /driver/documents (multipart: type, file) */
    public function uploadDocument(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(DriverDocument::TYPES)],
            'file' => 'required|file|mimes:jpg,jpeg,png,webp,heic,heif,pdf|max:10240',
        ]);

        try {
            return response()->json($this->application->uploadDocument($request->user(), $validated['type'], $request->file('file')));
        } catch (ProviderRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    /**
     * GET /driver/documents/{id}/file
     * Streams a private document to its owner or to a driver reviewer; 404 for everyone else.
     */
    public function documentFile(Request $request, int $id)
    {
        $path = $this->application->readableDocumentPath($request->user(), $id);

        return Storage::disk('local')->response($path, null, [
            'Cache-Control' => 'private, max-age=600',
        ]);
    }
}
