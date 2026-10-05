<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The old admin API allowed "confirmed" and "completed"; the booking
     * state machine now only knows pending → taken → ticket_ready →
     * delivered (+ cancelled). Map legacy rows so they aren't stuck.
     */
    public function up(): void
    {
        DB::table('bookings')->where('status', 'confirmed')
            ->update(['status' => DB::raw("CASE WHEN ticket_photo_url IS NULL THEN 'taken' ELSE 'ticket_ready' END")]);
        DB::table('bookings')->where('status', 'completed')->update(['status' => 'delivered']);
    }

    public function down(): void
    {
        // Irreversible data mapping; the old statuses are no longer valid.
    }
};
