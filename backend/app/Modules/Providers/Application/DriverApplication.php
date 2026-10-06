<?php

namespace App\Modules\Providers\Application;

use App\Models\DriverDocument;
use App\Models\DriverProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * "Become a driver" (story S1.1) and private driver documents (story S1.2):
 * offered services, licence, documents and submission for review.
 * Documents live on the private `local` disk and are readable only by their
 * owner and driver reviewers. Input is validated by the transport.
 */
class DriverApplication
{
    public const LICENCE_CATEGORIES = ['A', 'B', 'C', 'C1', 'D', 'D1', 'E', 'F'];

    /** @param string[] $services */
    public function chooseServices(User $user, array $services): array
    {
        $this->profile($user)->update(['services' => array_values($services)]);

        return $this->payload($user->fresh());
    }

    public function saveLicence(User $user, array $licence): array
    {
        $this->profile($user)->update($licence);

        return $this->payload($user->fresh());
    }

    /**
     * Send the application for review. Resubmitting after a rejection goes
     * back into the queue; verified and suspended drivers cannot resubmit.
     *
     * @throws ProviderRequestRejected
     */
    public function submit(User $user): array
    {
        $profile = $this->profile($user);

        if ($profile->verification_status === DriverProfile::STATUS_VERIFIED) {
            throw ProviderRequestRejected::message(409, 'You are already a verified driver.');
        }
        if ($profile->verification_status === DriverProfile::STATUS_SUSPENDED) {
            throw ProviderRequestRejected::message(409, 'Your driver account is suspended. Contact support.');
        }

        $checklist = DriverOnboarding::checklist($user);
        if (!$checklist['can_submit']) {
            $missing = collect($checklist['steps'])->filter(fn ($s) => $s['required'] && !$s['done'])->pluck('key');

            throw new ProviderRequestRejected(422, [
                'message' => 'Complete every step before submitting.',
                'errors'  => ['steps' => $missing->map(fn ($k) => "Step '$k' is not complete.")->values()->all()],
            ]);
        }

        // Resubmitting after a rejection goes back into the review queue
        $profile->forceFill([
            'verification_status' => DriverProfile::STATUS_PENDING,
            'submitted_at'        => now(),
            'rejection_reason'    => null,
        ])->save();

        return $this->payload($user->fresh());
    }

    /**
     * Store (or replace) one document privately; it goes back to "uploaded" for review.
     *
     * @throws ProviderRequestRejected an approved document cannot be replaced
     */
    public function uploadDocument(User $user, string $type, UploadedFile $file): array
    {
        $existing = $user->driverDocuments()->where('type', $type)->first();
        if ($existing?->status === DriverDocument::STATUS_APPROVED) {
            throw ProviderRequestRejected::message(409, 'This document is already approved.');
        }

        $path = $file->store("driver-documents/{$user->id}", 'local');
        if ($existing) {
            Storage::disk('local')->delete($existing->path);
        }

        // Re-uploading a rejected document sets it back to "uploaded" for review
        $user->driverDocuments()->updateOrCreate(
            ['type' => $type],
            ['path' => $path, 'status' => DriverDocument::STATUS_UPLOADED, 'rejection_reason' => null,
             'reviewed_by' => null, 'reviewed_at' => null],
        );

        return $this->payload($user->fresh());
    }

    /**
     * Path on the private `local` disk of a document $viewer may read: its owner
     * or a driver reviewer (verify-drivers). 404 for everyone else and for a missing file.
     */
    public function readableDocumentPath(User $viewer, int $id): string
    {
        $document = DriverDocument::findOrFail($id);
        abort_unless($document->user_id === $viewer->id || $viewer->hasPermission('verify-drivers'), 404);
        abort_unless(Storage::disk('local')->exists($document->path), 404);

        return $document->path;
    }

    /** Every document type with its requirement, review status and authenticated file URL. */
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

    /** GET /driver/onboarding body: checklist + services, licence and documents. */
    public function payload(User $user): array
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

    private function profile(User $user): DriverProfile
    {
        return $user->driverProfile()->firstOrCreate([]);
    }
}
