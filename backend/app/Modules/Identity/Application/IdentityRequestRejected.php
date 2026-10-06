<?php

namespace App\Modules\Identity\Application;

use RuntimeException;

/**
 * A sign-in or account/admin operation the rules refuse; nothing was written.
 * The transport returns $body as JSON with $status (bodies kept byte-identical
 * to the pre-module controllers, which differ per endpoint).
 */
final class IdentityRequestRejected extends RuntimeException
{
    /** @param array<string, mixed> $body */
    public function __construct(public readonly int $status, public readonly array $body)
    {
        parent::__construct(is_string($body['message'] ?? null) ? $body['message'] : (string) ($body['error'] ?? ''));
    }

    /** {"message": "..."} */
    public static function message(int $status, string $message): self
    {
        return new self($status, ['message' => $message]);
    }

    /** {"error": "...", "message": "..."} */
    public static function errorAndMessage(int $status, string $error, string $message): self
    {
        return new self($status, ['error' => $error, 'message' => $message]);
    }

    /** {"error": "..."} */
    public static function error(int $status, string $error): self
    {
        return new self($status, ['error' => $error]);
    }
}
