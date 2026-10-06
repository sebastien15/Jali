<?php

namespace App\Http\Controllers;

use App\Models\DriverDocument;
use App\Models\DriverProfile;
use App\Models\User;
use App\Modules\Providers\Application\DriverOnboarding;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * "Become a driver" (story S1.1) and driver documents (story S1.2).
 * Open to every signed-in user (permission apply-as-driver).
 */
class DriverOnboardingController extends Controller
{
    public const LICENCE_CATEGORIES = ['A', 'B', 'C', 'C1', 'D', 'D1', 'E', 'F'];

    /** GET /driver/onboarding */
    public function show(Request $request)
    {
        return response()->json($this->payload($request->user()));
    }

    /** PUT /driver/onboarding/services */
    public function services(Request $request)
    {
        $validated = $request->validate([
            'services'   => 'required|array|min:1',
            'services.*' => 'string|distinct|in:ride,hire,private_seat,rental',
        ]);
        $this->profile($request->user())->update(['services' => array_values($validated['services'])]);

        return response()->json($this->payload($request->user()->fresh()));
    }

    /** PUT /driver/onboarding/licence */
    public function licence(Request $request)
    {
        $validated = $request->validate([
            'licence_no'           => 'required|string|max:50',
            'licence_categories'   => 'required|array|min:1',
            'licence_categories.*' => ['string', 'distinct', Rule::in(self::LICENCE_CATEGORIES)],
            'licence_expiry'       => 'required|date_format:Y-m-d|after:today',
            'national_id_no'       => 'sometimes|nullable|string|max:50',
        ], [
            'licence_expiry.after' => 'Your driving licence has expired. Renew it before applying.',
        ]);
        $this->profile($request->user())->update($validated);

        return response()->json($this->payload($request->user()->fresh()));
    }

    /** POST /driver/onboarding/submit */
    public function submit(Request $request)
    {
        $user = $request->user();
        $profile = $this->profile($user);

        if ($profile->verification_status === DriverProfile::STATUS_VERIFIED) {
            return response()->json(['message' => 'You are already a verified driver.'], 409);
        }
        if ($profile->verification_status === DriverProfile::STATUS_SUSPENDED) {
            return response()->json(['message' => 'Your driver account is suspended. Contact support.'], 409);
        }

        $checklist = DriverOnboarding::checklist($user);
        if (!$checklist['can_submit']) {
            $missing = collect($checklist['steps'])->filter(fn ($s) => $s['required'] && !$s['done'])->pluck('key');

            return response()->json([
                'message' => 'Complete every step before submitting.',
                'errors'  => ['steps' => $missing->map(fn ($k) => "Step '$k' is not complete.")->values()->all()],
            ], 422);
        }

        // Resubmitting after a rejection goes back into the review queue
        $profile->forceFill([
            'verification_status' => DriverProfile::STATUS_PENDING,
            'submitted_at'        => now(),
            'rejection_reason'    => null,
        ])->save();

        return response()->json($this->payload($user->fresh()));
    }

    /** POST /driver/documents (multipart: type, file) */
    public function uploadDocument(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'type' => ['required', Rule::in(DriverDocument::TYPES)],
            'file' => 'required|file|mimes:jpg,jpeg,png,webp,heic,heif,pdf|max:10240',
        ]);

        $existing = $user->driverDocuments()->where('type', $validated['type'])->first();
        if ($existing?->status === DriverDocument::STATUS_APPROVED) {
            return response()->json(['message' => 'This document is already approved.'], 409);
        }

        $path = $request->file('file')->store("driver-documents/{$user->id}", 'local');
        if ($existing) {
            Storage::disk('local')->delete($existing->path);
        }

        // Re-uploading a rejected document sets it back to "uploaded" for review
        $user->driverDocuments()->updateOrCreate(
            ['type' => $validated['type']],
            ['path' => $path, 'status' => DriverDocument::STATUS_UPLOADED, 'rejection_reason' => null,
             'reviewed_by' => null, 'reviewed_at' => null],
        );

        return response()->json($this->payload($user->fresh()));
    }

    /**
     * GET /driver/documents/{id}/file
     * Streams a private document to its owner or to a driver reviewer; 404 for everyone else.
     */
    public function documentFile(Request $request, int $id)
    {
        $user = $request->user();
        $document = DriverDocument::findOrFail($id);
        abort_unless($document->user_id === $user->id || $user->hasPermission('verify-drivers'), 404);
        abort_unless(Storage::disk('local')->exists($document->path), 404);

        return Storage::disk('local')->response($document->path, null, [
            'Cache-Control' => 'private, max-age=600',
        ]);
    }

    private function profile(User $user): DriverProfile
    {
        return $user->driverProfile()->firstOrCreate([]);
    }

    public static function documentsPayload(User $user): array
    {
        $profile = $user->driverProfile;
        $docs = $user->driverDocuments->keyBy('type');
        $required = DriverOnboarding::requiredDocuments($profile->services ?? []);

        return array_map(fn ($type) => [
            'type'             => $type,
            'required'         => in_array($type, $required, true),
            'status'           => $docs[$type]->status ?? 'missing',
            'rejection_reason' => $docs[$type]->rejection_reason ?? null,
            'id'               => $docs[$type]->id ?? null,
            'file_url'         => isset($docs[$type]) ? url("/api/driver/documents/{$docs[$type]->id}/file") : null,
            'updated_at'       => isset($docs[$type]) ? $docs[$type]->updated_at?->toIso8601String() : null,
        ], DriverDocument::TYPES);
    }

    private function payload(User $user): array
    {
        $user->load('driverProfile', 'driverDocuments', 'vehicles');
        $profile = $user->driverProfile;

        return DriverOnboarding::checklist($user) + [
            'services'         => $profile->services ?? [],
            'rejection_reason' => $profile?->verification_status === DriverProfile::STATUS_REJECTED ? $profile->rejection_reason : null,
            'licence'          => [
                'licence_no'         => $profile?->licence_no,
                'licence_categories' => $profile?->licence_categories ?? [],
                'licence_expiry'     => $profile?->licence_expiry?->format('Y-m-d'),
                'national_id_no'     => $profile?->national_id_no,
            ],
            'documents'        => self::documentsPayload($user),
        ];
    }
}
