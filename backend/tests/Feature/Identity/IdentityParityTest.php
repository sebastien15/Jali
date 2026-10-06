<?php

namespace Tests\Feature\Identity;

use App\Models\ActivityLog;
use App\Models\AdminStation;
use App\Models\AppAccess;
use App\Models\CarRental;
use App\Models\Location;
use App\Models\LocationChangeRequest;
use App\Models\Permission;
use App\Models\PrivateSeat;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * M03-Remaining characterization (Identity): account deletion effects, admin
 * user/role/permission management, admin profile, activity log, app access and
 * location change requests. Written against the pre-module controllers.
 */
class IdentityParityTest extends TestCase
{
    use RefreshDatabase;

    private function seat(User $owner): PrivateSeat
    {
        return PrivateSeat::create([
            'user_id' => $owner->id, 'driver' => $owner->name, 'from' => 'Kigali', 'to' => 'Huye',
            'dep' => '08:00', 'price' => 3000, 'seats' => 4, 'active' => true,
        ]);
    }

    private function car(User $owner, string $plate): CarRental
    {
        return CarRental::create([
            'user_id' => $owner->id, 'name' => 'RAV4', 'type' => 'SUV', 'price' => 50000, 'seats' => 5, 'plate' => $plate, 'active' => true,
        ]);
    }

    // ── Account deletion ─────────────────────────────────────────────────

    public function test_account_deletion_closes_every_service_and_anonymises_the_user(): void
    {
        $me = $this->makeUser('driver', [
            'email' => 'me@x.rw', 'phone' => '+250788000001', 'password' => 'secret123', 'firebase_uid' => 'fb-1',
            'fcm_token' => 'ExponentPushToken[me]', 'profile_image_url' => 'data:image/png;base64,AA', 'whatsapp_number' => '0788',
            'contract_doc_url' => '/c.pdf', 'cashout_method' => 'mobile', 'cashout_account_number' => '0788',
            'cashout_account_name' => 'Me', 'cashout_bank_name' => 'BK',
        ]);
        $other = $this->makeUser('driver');
        $me->createToken('a');
        $token = $me->createToken('b')->plainTextToken;
        $other->createToken('c');
        $station = AdminStation::create(['city' => 'Huye', 'name' => 'Huye Terminal', 'user_id' => $me->id]);
        $mySeat = $this->seat($me);
        $otherSeat = $this->seat($other);
        $myCar = $this->car($me, 'RAA1');
        $otherCar = $this->car($other, 'RAA2');
        $me->driverProfile()->create(['services' => ['ride']]);
        $other->driverProfile()->create(['services' => ['ride']]);

        $this->withToken($token)->deleteJson('/api/auth/me')->assertOk()->assertExactJson(['message' => 'Account deleted.']);

        $fresh = $me->fresh();
        $this->assertSame('Deleted user', $fresh->name);
        foreach (['email', 'phone', 'password', 'firebase_uid', 'fcm_token', 'profile_image_url', 'whatsapp_number',
            'contract_doc_url', 'cashout_method', 'cashout_account_number', 'cashout_account_name', 'cashout_bank_name'] as $field) {
            $this->assertNull($fresh->getRawOriginal($field), $field);
        }
        $this->assertSame(Role::where('name', 'user')->value('id'), (int) $fresh->role_id);
        $this->assertSame(0, $me->tokens()->count());
        $this->assertSame(1, $other->tokens()->count());
        $this->assertNull($station->fresh()->user_id);
        $this->assertFalse((bool) $mySeat->fresh()->active);
        $this->assertTrue((bool) $otherSeat->fresh()->active);
        $this->assertFalse((bool) $myCar->fresh()->active);
        $this->assertTrue((bool) $otherCar->fresh()->active);
        $this->assertNull($me->driverProfile()->first());
        $this->assertNotNull($other->driverProfile()->first());
    }

    public function test_last_superadmin_refusal_changes_nothing_but_a_second_superadmin_can_leave(): void
    {
        $only = $this->makeUser('superadmin', ['email' => 'boss@x.rw']);
        $token = $only->createToken('t')->plainTextToken;

        $this->withToken($token)->deleteJson('/api/auth/me')->assertStatus(422)
            ->assertExactJson(['message' => 'The last superadmin account cannot be deleted.']);
        $this->assertSame('boss@x.rw', $only->fresh()->email);
        $this->assertSame(1, $only->tokens()->count());

        $second = $this->makeUser('superadmin');
        Sanctum::actingAs($second);
        $this->deleteJson('/api/auth/me')->assertOk();
        $this->assertSame('user', $second->fresh()->role->name);
    }

    public function test_logout_revokes_only_this_token_and_stops_pushes(): void
    {
        $me = $this->makeUser('user', ['fcm_token' => 'ExponentPushToken[me]']);
        $me->createToken('other-device');
        $token = $me->createToken('this-device')->plainTextToken;

        $this->withToken($token)->postJson('/api/auth/logout')->assertOk()->assertExactJson(['message' => 'Logged out']);

        $this->assertSame(['other-device'], $me->tokens()->pluck('name')->all());
        $this->assertNull($me->fresh()->fcm_token);
    }

    // ── Users ────────────────────────────────────────────────────────────

    public function test_user_admin_list_shape_rename_and_refusals(): void
    {
        $zed = $this->makeUser('user', ['name' => 'Zed', 'email' => 'z@x.rw', 'phone' => '1']);
        $me = $this->actingAsRole('superadmin', ['name' => 'Alice']);

        $res = $this->getJson('/api/admin/users')->assertOk();
        $this->assertSame(['Alice', 'Zed'], array_column($res->json(), 'name'));
        $this->assertSame(['id' => $zed->id, 'name' => 'Zed', 'email' => 'z@x.rw', 'phone' => '1', 'role' => 'user'], $res->json(1));

        $this->patchJson("/api/admin/users/{$zed->id}", ['name' => 'Zed B'])->assertOk()
            ->assertExactJson(['id' => $zed->id, 'name' => 'Zed B', 'email' => 'z@x.rw', 'role' => 'user']);
        $this->patchJson("/api/admin/users/{$zed->id}", ['role' => 'nope'])->assertStatus(422);
        $this->patchJson("/api/admin/users/{$me->id}", ['role' => 'user'])->assertStatus(422)
            ->assertExactJson(['message' => 'You cannot change your own role.']);
        $this->patchJson('/api/admin/users/999999', ['name' => 'x'])->assertNotFound();
    }

    public function test_station_admin_cannot_list_users(): void
    {
        $this->actingAsRole('admin');
        $this->getJson('/api/admin/users')->assertForbidden();
    }

    // ── Roles and permissions ────────────────────────────────────────────

    public function test_roles_are_forbidden_without_manage_roles(): void
    {
        $this->actingAsRole('admin');
        $role = Role::where('name', 'user')->first();

        $this->getJson('/api/admin/roles')->assertForbidden();
        $this->postJson('/api/admin/roles', ['name' => 'hr'])->assertForbidden();
        $this->patchJson("/api/admin/roles/{$role->id}", ['description' => 'x'])->assertForbidden();
        $this->deleteJson("/api/admin/roles/{$role->id}")->assertForbidden();
        $this->getJson("/api/admin/roles/{$role->id}/permissions")->assertForbidden();
        $this->putJson("/api/admin/roles/{$role->id}/permissions", ['permission_ids' => []])->assertForbidden();
        $this->getJson('/api/admin/permissions')->assertForbidden();
        $this->assertFalse(Role::where('name', 'hr')->exists());
    }

    public function test_role_lifecycle_and_system_role_guards(): void
    {
        $this->actingAsRole('superadmin');
        $super = Role::where('name', 'superadmin')->first();
        $driver = Role::where('name', 'driver')->first();

        $created = $this->postJson('/api/admin/roles', ['name' => 'hr', 'description' => 'People'])->assertCreated();
        $id = $created->json('id');
        $created->assertExactJson(['id' => $id, 'name' => 'hr', 'description' => 'People', 'permission_count' => 0, 'user_count' => 0, 'is_system' => false]);

        $index = collect($this->getJson('/api/admin/roles')->assertOk()->json())->keyBy('name');
        $this->assertTrue($index['driver']['is_system']);
        $this->assertFalse($index['hr']['is_system']);
        $this->assertSame(1, $index['superadmin']['user_count']);

        $this->patchJson("/api/admin/roles/{$super->id}", ['description' => 'x'])->assertStatus(422)
            ->assertExactJson(['message' => 'Cannot edit the superadmin role.']);
        $this->patchJson("/api/admin/roles/$id", ['name' => 'people'])->assertOk()
            ->assertExactJson(['id' => $id, 'name' => 'people', 'description' => 'People']);

        $this->deleteJson("/api/admin/roles/{$driver->id}")->assertStatus(422)->assertExactJson(['message' => 'Cannot delete a system role.']);
        $member = $this->makeUser('user');
        $member->forceFill(['role_id' => $id])->save();
        $this->deleteJson("/api/admin/roles/$id")->assertStatus(422)->assertExactJson(['message' => 'Cannot delete a role that has users assigned.']);
        $member->forceFill(['role_id' => $driver->id])->save();
        $this->deleteJson("/api/admin/roles/$id")->assertOk()->assertExactJson(['message' => 'Role deleted.']);
        $this->assertNull(Role::find($id));
    }

    public function test_role_permission_sync(): void
    {
        $this->actingAsRole('superadmin');
        $super = Role::where('name', 'superadmin')->first();
        $user = Role::where('name', 'user')->first();
        $p = Permission::orderBy('id')->take(2)->pluck('id')->all();

        $super->permissions()->detach($p[0]);
        $this->putJson("/api/admin/roles/{$super->id}/permissions", ['permission_ids' => []])->assertOk()
            ->assertExactJson(['message' => 'Superadmin always has all permissions.']);
        $this->assertSame(Permission::count(), $super->permissions()->count());

        $this->putJson("/api/admin/roles/{$user->id}/permissions", [])->assertStatus(422);
        $this->putJson("/api/admin/roles/{$user->id}/permissions", ['permission_ids' => [999999]])->assertStatus(422);
        $this->putJson("/api/admin/roles/{$user->id}/permissions", ['permission_ids' => $p])->assertOk()
            ->assertExactJson(['message' => 'Permissions updated.']);
        $this->assertEqualsCanonicalizing($p, $user->permissions()->pluck('permissions.id')->all());

        $shown = $this->getJson("/api/admin/roles/{$user->id}/permissions")->assertOk()->json();
        $this->assertSame(['id', 'name', 'description', 'category'], array_keys($shown[0]));
        $all = $this->getJson('/api/admin/permissions')->assertOk()->json();
        $this->assertCount(Permission::count(), $all);
        $this->assertSame(['id', 'name', 'description', 'category'], array_keys($all[0]));
    }

    // ── Admin profile ────────────────────────────────────────────────────

    public function test_admin_profile_requires_confirm_bookings_and_logs_updates(): void
    {
        $this->actingAsRole('user');
        $this->getJson('/api/admin/profile')->assertForbidden();

        $admin = $this->actingAsRole('admin', ['phone' => '0788']);
        $station = AdminStation::create(['city' => 'Huye', 'district' => 'Huye', 'name' => 'Huye Terminal', 'user_id' => $admin->id]);

        $this->getJson('/api/admin/profile')->assertOk()
            ->assertJsonPath('assigned_station', ['id' => $station->id, 'city' => 'Huye', 'district' => 'Huye'])
            ->assertJsonPath('total_earnings', 0)->assertJsonPath('available_balance', 0)->assertJsonPath('roles', 'admin');

        $this->patchJson('/api/admin/profile', ['whatsapp_number' => '0799'])->assertOk()->assertJsonPath('whatsapp_number', '0799');
        $log = ActivityLog::where('action', 'profile_updated')->first();
        $this->assertSame(['fields' => ['whatsapp_number']], $log->details);
        $this->assertSame($admin->id, $log->admin_id);

        $this->getJson('/api/admin/profile/contract-template')->assertNotFound()->assertExactJson(['message' => 'Template not configured.']);
    }

    // ── Activity log and app access ──────────────────────────────────────

    public function test_logs_and_app_access_need_manage_admins(): void
    {
        $this->actingAsRole('admin');
        $this->getJson('/api/admin/logs')->assertForbidden();
        $this->getJson('/api/admin/logs/groups')->assertForbidden();
        $this->getJson('/api/admin/app-accesses')->assertForbidden();
        $this->getJson('/api/admin/access-stats')->assertForbidden();
    }

    public function test_log_filters_and_groups(): void
    {
        $agent = $this->makeUser('admin');
        foreach (['a_one', 'a_two', 'a_three'] as $action) {
            ActivityLog::create(['admin_id' => $agent->id, 'action' => $action, 'entity_type' => 'booking', 'entity_id' => 1, 'details' => []]);
        }
        $this->actingAsRole('superadmin');

        $this->assertSame(['a_one'], array_column($this->getJson('/api/admin/logs?action=a_one')->json('data'), 'action'));
        $this->assertEqualsCanonicalizing(['a_one', 'a_two'], array_column($this->getJson('/api/admin/logs?action=a_one,a_two')->json('data'), 'action'));
        $this->assertSame(2, $this->getJson('/api/admin/logs?per_page=2')->json('per_page'));
        $this->assertEqualsCanonicalizing(['a_one', 'a_two', 'a_three'], $this->getJson('/api/admin/logs/groups')->json());
    }

    public function test_app_access_list_and_stats(): void
    {
        $u = $this->makeUser('user', ['email' => 'u@x.rw']);
        AppAccess::create(['platform' => 'ios', 'user_id' => $u->id, 'ip_address' => '1.1.1.1', 'accessed_at' => now()]);
        AppAccess::create(['platform' => 'android', 'ip_address' => '1.1.1.2', 'accessed_at' => now()->subDays(40)]);
        $this->actingAsRole('superadmin');

        $this->getJson('/api/admin/access-stats')->assertOk()
            ->assertExactJson(['all_time' => ['android' => 1, 'ios' => 1], 'last_30_days' => ['ios' => 1]]);
        $rows = $this->getJson('/api/admin/app-accesses?platform=ios')->assertOk()->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame(['id', 'platform', 'user_email', 'user_name', 'ip_address', 'district', 'accessed_at'], array_keys($rows[0]));
        $this->assertSame('u@x.rw', $rows[0]['user_email']);

        $this->postJson('/api/track-access', ['platform' => 'tv'])->assertStatus(422);
        $this->postJson('/api/track-access', ['platform' => 'web'])->assertOk()->assertExactJson(['ok' => true]);
    }

    // ── Location change requests ─────────────────────────────────────────

    public function test_location_requests_duplicate_and_processed_guards(): void
    {
        $this->seed();
        [$from, $to] = Location::orderBy('id')->take(2)->get()->all();
        $admin = $this->actingAsRole('admin', ['location_id' => $from->id]);

        $this->postJson('/api/admin/location-request', ['to_location_id' => $to->id])->assertCreated()
            ->assertJsonPath('from_location_id', $from->id)->assertJsonPath('to_location.id', $to->id)->assertJsonPath('status', 'pending');
        $this->postJson('/api/admin/location-request', ['to_location_id' => $to->id])->assertStatus(422)
            ->assertExactJson(['error' => 'You already have a pending location change request.']);

        $req = LocationChangeRequest::first();
        Sanctum::actingAs($this->makeUser('superadmin'));
        $this->assertCount(1, $this->getJson('/api/admin/location-requests?status=pending')->json());
        $this->postJson("/api/admin/location-requests/{$req->id}/reject")->assertOk()->assertExactJson(['message' => 'Location change rejected.']);
        $this->postJson("/api/admin/location-requests/{$req->id}/approve")->assertStatus(422)->assertExactJson(['error' => 'Request already processed.']);
        $this->postJson("/api/admin/location-requests/{$req->id}/reject")->assertStatus(422);
        $this->assertSame($from->id, (int) $admin->fresh()->location_id);
        $this->assertSame(['admin' => $admin->name], ActivityLog::where('action', 'location_change_rejected')->first()->details);
    }
}
