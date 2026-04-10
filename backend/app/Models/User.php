<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        "firebase_uid",
        "name",
        "phone",
        "email",
        "fcm_token",
        "profile_image_url",
        "whatsapp_number",
        "contract_doc_url",
        "contract_verified",
    ];

    protected $hidden = [];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, "user_roles");
    }

    public function permissions()
    {
        return $this->roles()
            ->with("permissions")
            ->get()
            ->pluck("permissions")
            ->flatten()
            ->unique("id");
    }

    public function hasPermission(string $permission): bool
    {
        return $this->permissions()->contains("name", $permission);
    }

    public function hasRole(string $role): bool
    {
        return $this->roles()->where("name", $role)->exists();
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

    // Location this admin is assigned to
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, "location_id");
    }

    // Outgoing location change requests
    public function locationChangeRequests(): HasMany
    {
        return $this->hasMany(LocationChangeRequest::class, "admin_id");
    }

    // Activity logs
    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, "admin_id");
    }
}
