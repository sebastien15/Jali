<?php

namespace Tests\Feature\Rides;

use App\Models\Role;
use App\Models\User;
use App\Modules\Locations\Application\PlaceSearch;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

class PlaceSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::create(['name' => 'Rider', 'role_id' => Role::where('name', 'user')->value('id')]));
    }

    /** @test */
    public function search_returns_rwandan_places_and_is_cached()
    {
        Http::fake([PlaceSearch::BASE . '/search*' => Http::response([
            ['name' => 'Kigali Convention Centre', 'display_name' => 'Kigali Convention Centre, KG 2 Roundabout, Kimihurura, Gasabo, Kigali, 2059, Rwanda', 'lat' => '-1.9536', 'lon' => '30.0928'],
            ['name' => '', 'display_name' => 'Kimironko Market, Kimironko, Gasabo, Kigali, Rwanda', 'lat' => '-1.9493', 'lon' => '30.1254'],
        ])]);

        $response = $this->getJson('/api/places/search?q=Kigali%20convention&lat=-1.95&lng=30.06')->assertOk()
            ->assertJsonPath('0.name', 'Kigali Convention Centre')
            ->assertJsonPath('0.address', 'Kigali Convention Centre, KG 2 Roundabout, Kimihurura')
            ->assertJsonPath('1.name', 'Kimironko Market');
        OpenApiContract::assertResponse($response, 'get', '/places/search');
        $this->assertSame(-1.9536, $response->json('0.lat'));

        Http::assertSent(fn ($r) => $r['countrycodes'] === 'rw' && isset($r['viewbox']) && $r->hasHeader('User-Agent'));

        $this->getJson('/api/places/search?q=kigali  CONVENTION&lat=-1.95&lng=30.06')->assertOk();
        Http::assertSentCount(1);   // second call served from cache
    }

    /** @test */
    public function provider_errors_return_an_empty_list()
    {
        Http::fake([PlaceSearch::BASE . '/*' => Http::response('down', 503)]);

        $this->getJson('/api/places/search?q=Remera')->assertOk()->assertExactJson([]);
    }

    /** @test */
    public function reverse_geocoding_falls_back_to_coordinates()
    {
        Http::fake([PlaceSearch::BASE . '/reverse*' => Http::sequence()
            ->push(['name' => 'Kigali Heights', 'display_name' => 'Kigali Heights, KG 7 Ave, Kacyiru, Gasabo, Kigali, Rwanda'])
            ->push('nope', 500)]);

        $response = $this->getJson('/api/places/reverse?lat=-1.9530&lng=30.0920')->assertOk()
            ->assertJsonPath('name', 'Kigali Heights')->assertJsonPath('address', 'Kigali Heights, KG 7 Ave, Kacyiru');
        OpenApiContract::assertResponse($response, 'get', '/places/reverse');

        $this->getJson('/api/places/reverse?lat=-1.9000&lng=30.1000')->assertOk()
            ->assertJsonPath('name', 'Pinned location')->assertJsonPath('address', '-1.90000, 30.10000');
    }

    /** @test */
    public function queries_are_validated()
    {
        OpenApiContract::assertResponse($this->getJson('/api/places/search?q=a')->assertStatus(422), 'get', '/places/search');
        $this->getJson('/api/places/reverse?lat=200')->assertStatus(422);
    }
}
