<?php

namespace App\Modules\Providers\Contracts;

/**
 * How a person is shown to the other side of a job (rides, hires, safety
 * share links): first name + last initial, never the full name.
 */
interface ProviderDisplay
{
    /** "Jean Paul Habimana" → "Jean H."; empty → "Driver" */
    public function displayName(?string $name): string;
}
