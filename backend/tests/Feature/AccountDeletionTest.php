<?php

namespace Tests\Feature;

use App\Models\AdminStation;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_account_wipes_personal_data_but_keeps_history(): void
    {
        $user = $this->makeUser('user', ['email' => 'me@x.rw', 'phone' => '+250788000001']);
        $token = $user->createToken('api-token')->plainTextToken;
        $booking = Booking::create([
            'user_id' => $user->id, 'type' => 'trip', 'reference_id' => 1, 'title' => 't', 'sub' => '',
            'price' => 1000, 'service_fee' => 500, 'status' => 'delivered', 'payment_method' => 'Card',
        ]);

        $this->withToken($token)->deleteJson('/api/auth/me')->assertOk();

        $fresh = $user->fresh();
        $this->assertNull($fresh->email);
        $this->assertNull($fresh->phone);
        $this->assertSame('Deleted user', $fresh->name);
        $this->assertNotNull($booking->fresh());
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_deleting_station_agent_does_not_delete_the_terminal(): void
    {
        $agent = $this->actingAsRole('admin');
        $station = AdminStation::create(['city' => 'Huye', 'name' => 'Huye Terminal', 'user_id' => $agent->id]);

        $this->deleteJson('/api/auth/me')->assertOk();

        $this->assertNotNull($station->fresh());
        $this->assertNull($station->fresh()->user_id);
    }

    public function test_last_superadmin_cannot_delete_their_account(): void
    {
        $this->actingAsRole('superadmin');

        $this->deleteJson('/api/auth/me')->assertStatus(422);
        $this->assertSame(1, User::count());
    }
}
