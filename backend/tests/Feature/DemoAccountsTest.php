<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** One-tap demo accounts exist only when JALI_ENV=dev. */
class DemoAccountsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_dev_stage_lists_and_logs_in_as_each_role(): void
    {
        config(['app.stage' => 'dev']);
        $this->getJson('/api/auth/demo-accounts')->assertOk()->assertJsonPath('enabled', true)->assertJsonPath('stage', 'dev')
            ->assertJsonCount(4, 'accounts');

        foreach (['customer' => 'user', 'driver' => 'driver', 'agent' => 'admin', 'superadmin' => 'superadmin'] as $key => $role) {
            $res = $this->postJson('/api/auth/demo-login', ['key' => $key])->assertOk()->assertJsonPath('user.roles', $role);
            $this->assertNotEmpty($res->json('token'));
        }
        // Same account every time; the driver can go online with a verified profile and a car
        $this->postJson('/api/auth/demo-login', ['key' => 'driver'])->assertOk();
        $driver = User::where('phone', '+250700000002')->firstOrFail();
        $this->assertSame(1, User::where('phone', '+250700000002')->count());
        $this->assertTrue($driver->driverProfile->isVerified());
        $this->assertSame(1, $driver->vehicles()->count());
        $this->postJson('/api/auth/demo-login', ['key' => 'nobody'])->assertNotFound();
    }

    public function test_test_and_prod_stages_have_no_demo_accounts(): void
    {
        foreach (['test', 'prod'] as $stage) {
            config(['app.stage' => $stage]);
            $this->getJson('/api/auth/demo-accounts')->assertOk()->assertJsonPath('enabled', false)->assertJsonPath('accounts', []);
            $this->postJson('/api/auth/demo-login', ['key' => 'superadmin'])->assertNotFound();
        }
        $this->assertSame(0, User::where('phone', 'like', '+2507000000%')->count());
    }
}
