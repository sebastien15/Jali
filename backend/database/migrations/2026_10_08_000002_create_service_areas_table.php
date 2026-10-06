<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * S10.4: service areas (cities) and special zones (airport, stadium…), each a
 * polygon of [lat, lng] points. A city can switch services off and override
 * ride settings. Kigali is seeded active; other cities are seeded switched off.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_areas', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('kind', 10)->default('city');          // city | zone
            $table->string('zone_type', 20)->nullable();          // airport | stadium | station | pickup | other
            $table->foreignId('parent_id')->nullable()->constrained('service_areas')->nullOnDelete();
            $table->json('polygon');                               // [[lat, lng], …]
            $table->decimal('min_lat', 9, 6);
            $table->decimal('max_lat', 9, 6);
            $table->decimal('min_lng', 9, 6);
            $table->decimal('max_lng', 9, 6);
            $table->boolean('active')->default(false);
            $table->json('overrides')->nullable();                 // ride settings + services on/off
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['kind', 'active']);
        });

        $now = now();
        $box = fn (float $lat, float $lng, float $dLat, float $dLng) => [
            [$lat - $dLat, $lng - $dLng], [$lat - $dLat, $lng + $dLng], [$lat + $dLat, $lng + $dLng], [$lat + $dLat, $lng - $dLng],
        ];
        $cities = [
            ['Kigali', $box(-1.955, 30.10, 0.13, 0.17), true],
            ['Musanze', $box(-1.4993, 29.6345, 0.06, 0.06), false],
            ['Rubavu', $box(-1.6779, 29.2571, 0.06, 0.06), false],
            ['Huye', $box(-2.6036, 29.7394, 0.06, 0.06), false],
        ];
        $kigaliId = null;
        foreach ($cities as [$name, $polygon, $active]) {
            $id = DB::table('service_areas')->insertGetId($this->row($name, 'city', null, null, $polygon, $active, $now));
            $kigaliId ??= $id;
        }
        DB::table('service_areas')->insert($this->row('Kigali International Airport', 'zone', 'airport', $kigaliId,
            $box(-1.9686, 30.1395, 0.008, 0.008), true, $now));

        DB::table('permissions')->updateOrInsert(
            ['name' => 'manage-service-areas'],
            ['description' => 'Define service areas, zones and per-city settings', 'category' => 'Rides', 'created_at' => $now, 'updated_at' => $now]
        );
        $permissionId = DB::table('permissions')->where('name', 'manage-service-areas')->value('id');
        foreach (DB::table('roles')->where('name', 'superadmin')->pluck('id') as $roleId) {
            DB::table('role_permissions')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }
    }

    private function row(string $name, string $kind, ?string $zoneType, ?int $parentId, array $polygon, bool $active, $now): array
    {
        $lats = array_column($polygon, 0);
        $lngs = array_column($polygon, 1);

        return [
            'name' => $name, 'kind' => $kind, 'zone_type' => $zoneType, 'parent_id' => $parentId,
            'polygon' => json_encode($polygon), 'active' => $active,
            'min_lat' => min($lats), 'max_lat' => max($lats), 'min_lng' => min($lngs), 'max_lng' => max($lngs),
            'created_at' => $now, 'updated_at' => $now,
        ];
    }

    public function down(): void
    {
        Schema::dropIfExists('service_areas');
        DB::table('permissions')->where('name', 'manage-service-areas')->delete();
    }
};
