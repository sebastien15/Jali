<?php

namespace App\Support;

/** Which stage this backend runs as (config app.stage, env JALI_ENV): dev | test | prod */
final class AppStage
{
    public static function current(): string
    {
        return (string) config('app.stage', 'prod');
    }

    /** Demo accounts and other development helpers are only ever on in dev */
    public static function isDev(): bool
    {
        return self::current() === 'dev';
    }
}
