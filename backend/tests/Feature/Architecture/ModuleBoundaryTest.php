<?php

namespace Tests\Feature\Architecture;

use Illuminate\Filesystem\Filesystem;
use Symfony\Component\Finder\Finder;
use Tests\TestCase;

/**
 * Architecture migration guard (runbook §4 boundary rules).
 *
 * Every PHP file under app/Modules/<X>/ may reference another module <Y> only
 * as App\Modules\<Y>\Contracts\..., and only when app/Modules/boundaries.php
 * allows X to depend on Y. Module code must never reference HTTP controllers.
 * Code still outside app/Modules (controllers, app/Services) is not scanned.
 */
class ModuleBoundaryTest extends TestCase
{
    public function test_module_dependencies_follow_the_reviewed_manifest(): void
    {
        $this->assertSame([], self::violations(app_path('Modules'), require app_path('Modules/boundaries.php')));
    }

    /**
     * App\Services\Rides was split up and deleted in M03-Rides (ride logic is in
     * NearbyRides, shared pieces in Pricing/Providers/Locations). Nothing may
     * bring the old namespace back.
     */
    public function test_nothing_references_the_removed_app_services_rides_namespace(): void
    {
        $this->assertDirectoryDoesNotExist(app_path('Services/Rides'));

        $dirs = array_filter([app_path(), base_path('routes'), base_path('config'), base_path('database'), base_path('bootstrap')], 'is_dir');
        $found = [];
        foreach ((new Finder())->files()->in($dirs)->exclude('cache')->name('*.php') as $file) {
            $code = str_replace('\\\\', '\\', $file->getContents());
            if (preg_match_all('/App\\\\Services\\\\Rides\\\\\w+/', $code, $refs)) {
                foreach ($refs[0] as $fqcn) {
                    $found[] = str_replace('\\', '/', $file->getRelativePathname()) . ": $fqcn";
                }
            }
        }

        $this->assertSame([], $found);
    }

    public function test_the_check_detects_forbidden_references(): void
    {
        $root = sys_get_temp_dir() . '/jali-boundary-' . uniqid();
        $files = [
            'Alpha/Application/Ok.php' => <<<'PHP'
                <?php
                namespace App\Modules\Alpha\Application;
                use App\Modules\Beta\Contracts\Port;
                use App\Modules\Alpha\Application\Other;
                PHP,
            'Alpha/Application/Bad.php' => <<<'PHP'
                <?php
                namespace App\Modules\Alpha\Application;
                use App\Modules\Beta\Application\Internal;
                PHP,
            'Alpha/Application/Inline.php' => <<<'PHP'
                <?php
                namespace App\Modules\Alpha\Application;
                class Inline { function f() { return app('App\\Modules\\Gamma\\Contracts\\Port'); } }
                PHP,
            'Alpha/Application/Http.php' => <<<'PHP'
                <?php
                namespace App\Modules\Alpha\Application;
                use App\Http\Controllers\BookingController;
                PHP,
            'Beta/Contracts/Port.php' => "<?php\n",
            'Gamma/Contracts/Port.php' => "<?php\n",
            'Unlisted/Application/X.php' => "<?php\n",
        ];
        foreach ($files as $path => $code) {
            @mkdir(dirname("$root/$path"), 0777, true);
            file_put_contents("$root/$path", $code);
        }

        try {
            $found = self::violations($root, ['Alpha' => ['Beta'], 'Beta' => [], 'Gamma' => []]);
        } finally {
            (new Filesystem())->deleteDirectory($root);
        }

        $this->assertSame([
            'Alpha/Application/Bad.php: App\Modules\Beta\Application\Internal (only Beta\Contracts may be used)',
            'Alpha/Application/Http.php: App\Http\Controllers\BookingController (modules must not reference controllers)',
            'Alpha/Application/Inline.php: App\Modules\Gamma\Contracts\Port (Alpha may not depend on Gamma)',
            'Unlisted: module has no entry in boundaries.php',
        ], $found);
    }

    /** @return string[] sorted human-readable violations */
    public static function violations(string $modulesDir, array $manifest): array
    {
        if (!is_dir($modulesDir)) {
            return [];
        }
        $violations = [];

        foreach (glob($modulesDir . '/*', GLOB_ONLYDIR) as $dir) {
            if (!array_key_exists(basename($dir), $manifest)) {
                $violations[] = basename($dir) . ': module has no entry in boundaries.php';
            }
        }

        foreach ((new Finder())->files()->in($modulesDir)->name('*.php') as $file) {
            $relative = str_replace('\\', '/', $file->getRelativePathname());
            if (!str_contains($relative, '/')) {
                continue;   // boundaries.php and other root files belong to no module
            }
            $module = strstr($relative, '/', true);
            // A class name written in a string ('App\\Modules\\X') counts like a real reference
            $code = str_replace('\\\\', '\\', $file->getContents());

            preg_match_all('/App\\\\Modules\\\\(\w+)((?:\\\\[\w{]*)*)/', $code, $refs, PREG_SET_ORDER);
            foreach ($refs as [$fqcn, $target, $rest]) {
                if ($target === $module) {
                    continue;
                }
                if (!str_starts_with($rest, '\\Contracts\\')) {
                    $violations[] = "$relative: $fqcn (only {$target}\\Contracts may be used)";
                } elseif (!in_array($target, $manifest[$module] ?? [], true)) {
                    $violations[] = "$relative: $fqcn ($module may not depend on $target)";
                }
            }

            preg_match_all('/App\\\\Http\\\\Controllers[\w\\\\]*/', $code, $controllers);
            foreach ($controllers[0] as $fqcn) {
                $violations[] = "$relative: $fqcn (modules must not reference controllers)";
            }
        }

        $violations = array_values(array_unique($violations));
        sort($violations);

        return $violations;
    }
}
