<?php

namespace App\Modules\Bus\Application;

use RuntimeException;

/**
 * A bus/agency/route/departure operation the rules refuse; nothing was written.
 * The transport returns $body as JSON with $status (bodies kept byte-identical
 * to the pre-module controllers, which differ per endpoint).
 */
final class BusRequestRejected extends RuntimeException
{
    /** @param array<string, string> $body */
    public function __construct(public readonly int $status, public readonly array $body)
    {
        parent::__construct($body['message'] ?? $body['error'] ?? '');
    }

    public static function error(int $status, string $error): self
    {
        return new self($status, ['error' => $error]);
    }

    public static function errorAndMessage(int $status, string $text): self
    {
        return new self($status, ['error' => $text, 'message' => $text]);
    }
}
