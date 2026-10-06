<?php

namespace App\Modules\Payments\Application;

use RuntimeException;

/**
 * A money operation the rules refuse; nothing was written. The transport
 * returns $body as JSON with $status (bodies kept byte-identical to the
 * pre-module controllers).
 */
final class PaymentRequestRejected extends RuntimeException
{
    /** @param array<string, mixed> $body */
    public function __construct(public readonly int $status, public readonly array $body)
    {
        parent::__construct((string) ($body['message'] ?? ''));
    }

    public static function message(int $status, string $message): self
    {
        return new self($status, ['message' => $message]);
    }
}
