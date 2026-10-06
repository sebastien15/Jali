<?php

namespace App\Modules\Notifications\Contracts;

/** Text messages to a phone number (OTP codes, SOS alerts). */
interface SmsSender
{
    /** Can this environment deliver real SMS? */
    public function canSend(): bool;

    /** Never throws; false when the message was not accepted. */
    public function send(string $phone, string $message): bool;
}
