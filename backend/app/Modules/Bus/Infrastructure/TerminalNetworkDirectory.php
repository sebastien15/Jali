<?php

namespace App\Modules\Bus\Infrastructure;

use App\Modules\Locations\Contracts\TerminalNetwork;
use Illuminate\Support\Facades\DB;

/**
 * Bus network facts for named terminals: province, the corridors each
 * terminal is a stop on, and the agencies running routes on each corridor.
 * Query and grouping moved unchanged from Admin\LocationController (M03-Bus).
 */
class TerminalNetworkDirectory implements TerminalNetwork
{
    public function byTerminalName(array $terminalNames): array
    {
        $rows = DB::table('admin_stations as st')
            ->join('corridor_terminals as ct', 'ct.terminal_id', '=', 'st.id')
            ->join('corridors as c', 'c.id', '=', 'ct.corridor_id')
            ->leftJoin('agency_routes as ar', 'ar.corridor_id', '=', 'c.id')
            ->leftJoin('agencies as a', 'a.id', '=', 'ar.agency_id')
            ->whereIn('st.name', $terminalNames)
            ->select(
                'st.name as terminal_name',
                'st.province',
                'c.id as corridor_id',
                'c.code',
                'c.name as corridor_name',
                'c.description as corridor_description',
                'ct.stop_order',
                'a.id as agency_id',
                'a.name as agency_name'
            )
            ->orderBy('st.name')
            ->orderBy('c.code')
            ->orderBy('a.name')
            ->get();

        // Group: terminal name → corridors → agencies
        $terminalData = [];
        foreach ($rows as $row) {
            $tn = $row->terminal_name;
            if (!isset($terminalData[$tn])) {
                $terminalData[$tn] = ['province' => $row->province, 'corridors' => []];
            }
            $cid = $row->corridor_id;
            if (!isset($terminalData[$tn]['corridors'][$cid])) {
                $terminalData[$tn]['corridors'][$cid] = [
                    'code'        => $row->code,
                    'name'        => $row->corridor_name,
                    'description' => $row->corridor_description,
                    'stop_order'  => $row->stop_order,
                    'agencies'    => [],
                ];
            }
            if ($row->agency_id) {
                $terminalData[$tn]['corridors'][$cid]['agencies'][$row->agency_id] = $row->agency_name;
            }
        }

        $result = [];
        foreach ($terminalData as $name => $data) {
            $corridors = [];
            foreach ($data['corridors'] as $c) {
                $corridors[] = [
                    'code'        => $c['code'],
                    'name'        => $c['name'],
                    'description' => $c['description'],
                    'stop_order'  => $c['stop_order'],
                    'agencies'    => array_values($c['agencies']),
                ];
            }
            usort($corridors, fn($a, $b) => strcmp($a['code'], $b['code']));
            $result[$name] = ['province' => $data['province'], 'corridors' => $corridors];
        }

        return $result;
    }
}
