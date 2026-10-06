<?php

namespace App\Modules\Locations\Contracts;

/**
 * Transport network facts about named terminals, used to enrich the admin
 * pickup-location list. Implemented by the service that owns the network
 * (Bus: stations, corridors, agency routes); Locations only reads it.
 */
interface TerminalNetwork
{
    /**
     * Terminal name → ['province' => ?string, 'corridors' => list of
     * ['code', 'name', 'description', 'stop_order', 'agencies' => list<string>]]
     * sorted by corridor code. Names with no terminal are absent.
     *
     * @param list<string> $terminalNames
     * @return array<string, array{province: ?string, corridors: list<array>}>
     */
    public function byTerminalName(array $terminalNames): array;
}
