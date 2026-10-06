<?php

namespace Tests\Feature\Architecture;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Architecture migration guard (runbook M01): the live API route list must
 * match docs/migration/routes-baseline.json exactly — same method, URI,
 * controller action and middleware for every route. A structural move that
 * changes any of these fails here. Regenerate the baseline only in a task
 * that is explicitly authorised to change routes.
 */
class RouteInventoryTest extends TestCase
{
    public function test_api_routes_match_the_recorded_baseline(): void
    {
        $path = base_path('../docs/migration/routes-baseline.json');
        $this->assertFileExists($path);

        $baseline = $this->normalise(json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR));

        Artisan::call('route:list', ['--path' => 'api', '--json' => true]);
        $live = $this->normalise(json_decode(Artisan::output(), true, flags: JSON_THROW_ON_ERROR));

        $this->assertSame([], array_values(array_diff($baseline, $live)), 'Routes missing or changed versus the baseline');
        $this->assertSame([], array_values(array_diff($live, $baseline)), 'Routes added or changed versus the baseline');
        $this->assertCount(count($baseline), $live, 'Route count differs from the baseline (duplicate route?)');
    }

    /** @return string[] one line per route: "METHOD uri action [middleware]" */
    private function normalise(array $routes): array
    {
        $lines = array_map(fn (array $r) => implode(' ', [
            $r['method'],
            $r['uri'],
            $r['action'],
            '[' . implode(',', (array) $r['middleware']) . ']',
        ]), $routes);
        sort($lines);

        return $lines;
    }
}
