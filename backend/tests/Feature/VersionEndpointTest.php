<?php

namespace Tests\Feature;

use Tests\TestCase;

class VersionEndpointTest extends TestCase
{
    public function test_reports_the_deployed_release_and_stage(): void
    {
        $file = base_path('release.txt');
        $had = is_file($file) ? file_get_contents($file) : null;
        file_put_contents($file, "abc123\n");
        config(['app.stage' => 'dev']);

        try {
            $this->getJson('/api/version')->assertOk()->assertExactJson(['release' => 'abc123', 'stage' => 'dev']);
        } finally {
            $had === null ? unlink($file) : file_put_contents($file, $had);
        }
    }
}
