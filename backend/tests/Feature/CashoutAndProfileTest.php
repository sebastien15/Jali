<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashoutAndProfileTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithEarnings(int $fee): User
    {
        $admin = $this->actingAsRole('admin', [
            'cashout_method' => 'mobile', 'cashout_account_number' => '0788000000',
        ]);
        $passenger = $this->makeUser('user');
        Booking::create([
            'user_id' => $passenger->id, 'type' => 'trip', 'reference_id' => 1, 'title' => 't', 'sub' => '',
            'price' => 5000, 'service_fee' => $fee, 'status' => 'delivered', 'payment_method' => 'Card',
            'confirmed_by' => $admin->id,
        ]);
        return $admin;
    }

    public function test_cashout_cannot_exceed_earnings(): void
    {
        $this->adminWithEarnings(1000); // earns 500

        $this->postJson('/api/admin/cashout/requests', ['amount' => 1000000])->assertStatus(422);
        $this->postJson('/api/admin/cashout/requests', ['amount' => 400])->assertCreated();
        // only 100 left after the pending 400
        $this->postJson('/api/admin/cashout/requests', ['amount' => 200])->assertStatus(422);
        $this->getJson('/api/admin/profile')->assertOk()->assertJsonPath('available_balance', 100);
    }

    public function test_profile_image_rejects_svg_and_oversized_payloads(): void
    {
        $this->actingAsRole('admin');

        $svg = 'data:image/svg+xml;base64,' . base64_encode('<svg onload="alert(1)"/>');
        $this->postJson('/api/admin/profile/image', ['image_base64' => $svg])->assertStatus(422);

        $huge = 'data:image/jpeg;base64,' . str_repeat('A', 400000);
        $this->postJson('/api/admin/profile/image', ['image_base64' => $huge])->assertStatus(422);

        $ok = 'data:image/jpeg;base64,' . base64_encode(random_bytes(2000));
        $this->postJson('/api/admin/profile/image', ['image_base64' => $ok])->assertOk();
    }
}
