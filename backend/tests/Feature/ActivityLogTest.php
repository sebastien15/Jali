<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_logs_do_not_expose_actor_contact_or_payout_details(): void
    {
        $agent = $this->makeUser('admin', [
            'phone' => '+250788999111', 'firebase_uid' => 'fb-secret', 'cashout_account_number' => '0788999111',
        ]);
        ActivityLog::create(['admin_id' => $agent->id, 'action' => 'booking_claimed', 'entity_type' => 'booking', 'entity_id' => 1, 'details' => []]);
        $this->actingAsRole('superadmin');

        $res = $this->getJson('/api/admin/logs')->assertOk()->assertJsonPath('data.0.admin.name', $agent->name);

        $body = $res->getContent();
        $this->assertStringNotContainsString('788999111', $body);
        $this->assertStringNotContainsString('fb-secret', $body);
    }
}
