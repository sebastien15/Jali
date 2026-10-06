<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * S7.4: Jali charges no fees. Zero any commission / service fee already saved
 * in platform_settings['rides'] so stored values don't override the new defaults.
 */
return new class extends Migration
{
    public function up(): void
    {
        $row = DB::table('platform_settings')->where('key', 'rides')->first();
        if (! $row) {
            return;
        }
        $value = json_decode((string) $row->value, true);
        if (! is_array($value)) {
            return;
        }
        $value['commission_pct'] = 0;
        $value['service_fee'] = ['type' => $value['service_fee']['type'] ?? 'flat', 'amount' => 0];
        if (isset($value['hire']) && is_array($value['hire'])) {
            $value['hire']['commission_pct'] = 0;
            $value['hire']['service_fee'] = 0;
        }
        DB::table('platform_settings')->where('id', $row->id)->update(['value' => json_encode($value)]);
    }

    public function down(): void
    {
        // Fees stay at 0; a superadmin can change them in ride settings.
    }
};
