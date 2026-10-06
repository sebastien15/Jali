<?php

namespace App\Modules\Identity\Application;

use App\Models\ActivityLog;
use App\Models\AdminStation;
use App\Models\User;
use App\Modules\Payments\Contracts\StaffEarnings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * A booking-desk admin's own profile (/admin/profile/**): contact details,
 * inline profile image, signed contract, assigned station and cashout figures
 * (from Payments). Every change is logged. Input is validated by the transport.
 */
class AdminProfile
{
    public function __construct(private readonly StaffEarnings $earnings)
    {
    }

    public function show(User $user): array
    {
        $user->load(["location", "role.permissions"]);

        $station = AdminStation::where('user_id', $user->id)->first();

        // Earnings for cashout display — 50% of service fees on delivered bookings
        $totalEarnings = $this->earnings->earnedBy($user);

        return [
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
            "available_balance" => $this->earnings->availableFor($user),
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
        ];
    }

    /** @param array{phone?: ?string, whatsapp_number?: ?string} $data */
    public function update(User $user, array $data): User
    {
        $user->update($data);

        ActivityLog::create([
            "admin_id" => $user->id,
            "action" => "profile_updated",
            "entity_type" => "user",
            "entity_id" => $user->id,
            "details" => ["fields" => array_keys($data)],
        ]);

        return $user->fresh();
    }

    /** $dataUri is an already validated raster data: URI, stored inline. */
    public function setProfileImage(User $user, string $dataUri): void
    {
        $user->update(['profile_image_url' => $dataUri]);

        ActivityLog::create([
            'admin_id'    => $user->id,
            'action'      => 'profile_image_uploaded',
            'entity_type' => 'user',
            'entity_id'   => $user->id,
            'details'     => ['source' => 'base64'],
        ]);
    }

    public function contractTemplateUrl(): ?string
    {
        return env('CONTRACT_TEMPLATE_URL') ?: null;
    }

    /** Stores a new signed contract; verification resets until reviewed again. Returns its public URL. */
    public function storeContract(User $user, UploadedFile $contract): string
    {
        $path = $contract->store("contracts", "public");
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

        return $url;
    }
}
