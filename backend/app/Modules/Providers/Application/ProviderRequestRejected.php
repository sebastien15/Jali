<?php

namespace App\Modules\Providers\Application;

use RuntimeException;

/**
 * A provider onboarding/verification/vehicle operation the rules refuse;
 * nothing was written. The transport returns $body as JSON with $status
 * (bodies kept byte-identical to the pre-module controllers).
 */
final class ProviderRequestRejected extends RuntimeException
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
