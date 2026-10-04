<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Collection;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        "firebase_uid",
        "name",
        "phone",
        "email",
        "password",
        "fcm_token",
        "role_id",
        "profile_image_url",
        "whatsapp_number",
        "contract_doc_url",
        "contract_verified",
        "cashout_method",
        "cashout_account_number",
        "cashout_account_name",
        "cashout_bank_name",
    ];

    protected $hidden = ["password", "remember_token", "fcm_token"];

    protected $casts = ["password" => "hashed", "driver_profile" => "array"];

    /**
     * Get the single role assigned to the user.
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Get permissions via the user's role.
     */
    public function permissions()
    {
        return $this->role && $this->role->permissions
            ? $this->role->permissions
            : new Collection();
    }

    public function hasPermission(string $permission): bool
    {
        return $this->permissions()->contains("name", $permission);
    }

    public function hasRole(string $roleName): bool
    {
        return $this->role && $this->role->name === $roleName;
    }

    public function isAdmin(): bool
    {
        return $this->hasRole("admin") || $this->hasRole("superadmin");
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole("superadmin");
    }

    public function isDriver(): bool
    {
        return $this->hasRole("driver");
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function adminStation(): HasOne
    {
        return $this->hasOne(AdminStation::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, "location_id");
    }

    public function locationChangeRequests(): HasMany
    {
        return $this->hasMany(LocationChangeRequest::class, "admin_id");
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, "admin_id");
    }
}
