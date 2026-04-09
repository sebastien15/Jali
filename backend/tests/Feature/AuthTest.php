<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_returns_unauthorized_when_no_token_provided()
    {
        $response = $this->postJson('/api/auth/login');

        $response->assertStatus(401)
            ->assertJson(['error' => 'Unauthorized']);
    }

    /** @test */
    public function it_returns_unauthorized_when_invalid_token_provided()
    {
        $response = $this->withHeaders([
            'Authorization' => 'Bearer invalid_token',
        ])->postJson('/api/auth/login');

        $response->assertStatus(401)
            ->assertJson(['error' => 'Unauthorized']);
    }
}
