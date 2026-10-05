<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/**
 * Keeps docs/api/openapi.yaml and the Laravel API in sync (story S21.9).
 */
class ApiContractTest extends TestCase
{
    use RefreshDatabase;

    /** Route prefixes owned by the contract: every route under them must be documented. */
    private const CONTRACT_PREFIXES = [
        'api/me', 'api/driver/profile', 'api/driver/vehicles', 'api/driver/rates', 'api/driver/presence',
        'api/driver/ride-requests', 'api/rides', 'api/admin/settings/rides',
    ];

    private function laravelRoutes(): array
    {
        $routes = [];
        foreach (Route::getRoutes() as $route) {
            foreach ($route->methods() as $method) {
                $routes[strtolower($method) . ' ' . $route->uri()] = true;
            }
        }

        return $routes;
    }

    private static function uri(string $path): string
    {
        return 'api' . $path;
    }

    /** @test */
    public function every_implemented_operation_exists_and_planned_ones_are_not_yet_built()
    {
        $routes = $this->laravelRoutes();

        foreach (OpenApiContract::operations() as $op) {
            $key = $op['method'] . ' ' . self::uri($op['path']);
            if ($op['planned']) {
                $this->assertArrayNotHasKey($key, $routes,
                    "$key is implemented — remove `x-jali-status: planned` from docs/api/openapi.yaml");
            } else {
                $this->assertArrayHasKey($key, $routes, "Contract documents $key but Laravel has no such route");
            }
        }
    }

    /** @test */
    public function every_route_under_contract_prefixes_is_documented()
    {
        $documented = [];
        foreach (OpenApiContract::operations() as $op) {
            $documented[$op['method'] . ' ' . self::uri($op['path'])] = true;
        }

        foreach (array_keys($this->laravelRoutes()) as $key) {
            [$method, $uri] = explode(' ', $key, 2);
            if ($method === 'head') {
                continue;
            }
            foreach (self::CONTRACT_PREFIXES as $prefix) {
                if ($uri === $prefix || str_starts_with($uri, $prefix . '/')) {
                    $this->assertArrayHasKey($key, $documented, "Route $key is missing from docs/api/openapi.yaml");
                }
            }
        }
    }

    /** @test */
    public function identity_responses_match_the_contract()
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::create(['name' => 'Rider', 'role_id' => Role::where('name', 'user')->value('id')]);

        OpenApiContract::assertResponse($this->getJson('/api/me'), 'get', '/me');

        Sanctum::actingAs($user);
        OpenApiContract::assertResponse($this->getJson('/api/me'), 'get', '/me');
        OpenApiContract::assertResponse($this->postJson('/api/me/push-token', []), 'post', '/me/push-token');
        OpenApiContract::assertResponse(
            $this->postJson('/api/me/push-token', ['token' => 'ExponentPushToken[x]']), 'post', '/me/push-token');
        OpenApiContract::assertResponse($this->deleteJson('/api/me/push-token'), 'delete', '/me/push-token');
    }
}
