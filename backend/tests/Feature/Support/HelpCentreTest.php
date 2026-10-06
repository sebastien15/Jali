<?php

namespace Tests\Feature\Support;

use App\Models\ActivityLog;
use App\Models\HelpTopic;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** S16.2: help centre topics in 4 languages, contextual to a trip. */
class HelpCentreTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function as(string $role): User
    {
        $user = User::create(['name' => $role, 'role_id' => Role::where('name', $role)->value('id')]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function topic(array $overrides = []): array
    {
        $t = fn (string $x) => ['en' => "$x EN", 'fr' => "$x FR", 'rw' => "$x RW", 'sw' => "$x SW"];

        return $overrides + ['slug' => 'payment-failed', 'title' => $t('Payment failed'), 'body' => $t('Try again'),
            'services' => ['rides'], 'contexts' => ['payment'], 'sort' => 5];
    }

    public function test_customers_read_topics_for_a_trip_in_their_language(): void
    {
        $this->as('user');
        $all = $this->getJson('/api/help/topics')->assertOk();
        OpenApiContract::assertResponse($all, 'get', '/help/topics');
        $this->assertSame(6, count($all->json('data')));

        // Contextual: a ride detail asks for ride topics; rental-only topics are left out
        $ride = collect($this->getJson('/api/help/topics?service=rides')->json('data'))->pluck('slug')->all();
        $this->assertContains('charged-wrong', $ride);
        $this->assertContains('driver-behaviour', $ride);
        $this->assertContains('lost-item', $ride);
        $this->assertContains('cancel-and-refunds', $ride);     // no services = every service
        $this->assertNotContains('rental-damage-deposit', $ride);

        $this->getJson('/api/help/topics?service=rides&context=lost_item')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.slug', 'lost-item');

        $fr = $this->getJson('/api/help/topics/lost-item?locale=fr')->assertOk()->assertJsonPath('title', "J'ai oublié un objet");
        OpenApiContract::assertResponse($fr, 'get', '/help/topics/{slug}');
        $this->getJson('/api/help/topics/lost-item', ['Accept-Language' => 'rw-RW'])->assertJsonPath('title', 'Nasizemo ikintu');
        $this->getJson('/api/help/topics?q=deposit')->assertJsonCount(1, 'data');
        $this->getJson('/api/help/topics?service=teleport')->assertStatus(422);
        $this->getJson('/api/help/topics/nope')->assertNotFound();
    }

    public function test_admins_write_topics_in_all_four_languages_and_it_is_logged(): void
    {
        $admin = $this->as('admin');
        $created = $this->postJson('/api/admin/help-topics', $this->topic())->assertCreated()
            ->assertJsonPath('title.sw', 'Payment failed SW');
        OpenApiContract::assertResponse($created, 'post', '/admin/help-topics');

        $missing = $this->topic(['slug' => 'other']);
        unset($missing['title']['rw']);
        $this->postJson('/api/admin/help-topics', $missing)->assertStatus(422)->assertJsonValidationErrors('title.rw');
        $this->postJson('/api/admin/help-topics', $this->topic())->assertStatus(422)->assertJsonValidationErrors('slug');

        $id = $created->json('id');
        $updated = $this->putJson("/api/admin/help-topics/$id", ['published' => false])->assertOk()->assertJsonPath('published', false);
        OpenApiContract::assertResponse($updated, 'put', '/admin/help-topics/{id}');
        OpenApiContract::assertResponse($this->getJson('/api/admin/help-topics')->assertOk()->assertJsonCount(7, 'data'), 'get', '/admin/help-topics');

        // Drafts are hidden from customers
        $this->as('user');
        $this->getJson('/api/help/topics/payment-failed')->assertNotFound();

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/admin/help-topics/$id")->assertNoContent();
        $this->assertSame(['help_topic_created', 'help_topic_updated', 'help_topic_deleted'],
            ActivityLog::where('entity_type', 'help_topic')->orderBy('id')->pluck('action')->all());
        $this->assertSame(6, HelpTopic::count());
    }

    public function test_only_support_staff_write_topics(): void
    {
        foreach (['user', 'driver'] as $role) {
            $this->as($role);
            $this->getJson('/api/help/topics')->assertOk();
            $this->getJson('/api/admin/help-topics')->assertStatus(403);
            $this->postJson('/api/admin/help-topics', $this->topic())->assertStatus(403);
        }
    }
}
