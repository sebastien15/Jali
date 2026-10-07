<?php

namespace App\Modules\Identity\Application;

use App\Models\DriverProfile;
use App\Models\Role;
use App\Models\User;
use App\Support\AppStage;
use Illuminate\Support\Facades\DB;

/**
 * One-tap demo accounts for the dev stage only (JALI_ENV=dev). Each is a
 * dedicated account (phone +2507000000xx), created on first use; real users
 * are never touched. Outside dev nothing is listed and login is refused.
 */
class DemoAccounts
{
    public const ACCOUNTS = [
        'customer'   => ['name' => 'Demo Customer', 'phone' => '+250700000001', 'role' => 'user',
            'description' => 'Book buses, shared seats, rides, drivers and rental cars'],
        'driver'     => ['name' => 'Demo Driver', 'phone' => '+250700000002', 'role' => 'driver',
            'description' => 'Verified driver with a car: rides, hire, shared journeys and car rental'],
        'agent'      => ['name' => 'Demo Station Agent', 'phone' => '+250700000003', 'role' => 'admin',
            'description' => 'Admin: bookings, drivers, rides, rentals and support'],
        'superadmin' => ['name' => 'Demo Superadmin', 'phone' => '+250700000004', 'role' => 'superadmin',
            'description' => 'Everything, including pricing, services and service areas'],
    ];

    public function __construct(private Authentication $auth)
    {
    }

    /** @return array{stage: string, enabled: bool, accounts: array} */
    public function list(): array
    {
        $enabled = AppStage::isDev();

        return [
            'stage'    => AppStage::current(),
            'enabled'  => $enabled,
            'accounts' => $enabled ? array_map(
                fn (string $key, array $a) => ['key' => $key, 'name' => $a['name'], 'role' => $a['role'], 'description' => $a['description']],
                array_keys(self::ACCOUNTS), self::ACCOUNTS,
            ) : [],
        ];
    }

    /** Token for a demo account, or null when not in dev or the key is unknown */
    public function login(string $key): ?array
    {
        if (!AppStage::isDev() || !isset(self::ACCOUNTS[$key])) {
            return null;
        }

        return $this->auth->issueToken($this->account($key));
    }

    private function account(string $key): User
    {
        $a = self::ACCOUNTS[$key];

        return DB::transaction(function () use ($key, $a) {
            $user = User::firstOrCreate(['phone' => $a['phone']], ['name' => $a['name']]);
            $roleId = Role::where('name', $a['role'])->value('id');
            if ($roleId && (int) $user->role_id !== (int) $roleId) {
                $user->forceFill(['role_id' => $roleId])->save();
            }
            if ($key === 'driver') {
                // Ready to go online: verified profile and an active, insured car with a photo
                $profile = $user->driverProfile()->firstOrCreate([], ['services' => ['ride', 'hire'], 'licence_categories' => ['B']]);
                if ($profile->verification_status !== DriverProfile::STATUS_VERIFIED) {
                    $profile->forceFill(['verification_status' => DriverProfile::STATUS_VERIFIED, 'transmissions' => ['automatic', 'manual'],
                        'languages' => ['rw', 'en'], 'years_experience' => 5])->save();
                }
                if (!$user->vehicles()->exists()) {
                    $user->vehicles()->create(['make' => 'Toyota', 'model' => 'RAV4', 'color' => 'White', 'plate' => 'RAD 000 D', 'class' => 'car',
                        'seats' => 4, 'year' => 2019, 'is_active' => true, 'insurance_expiry' => now()->addYear(), 'photos' => []]);
                }
            }

            return $user->fresh('role');
        });
    }
}
