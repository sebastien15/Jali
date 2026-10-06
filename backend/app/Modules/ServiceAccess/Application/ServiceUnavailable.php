<?php

namespace App\Modules\ServiceAccess\Application;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** A service is not taking new requests: 403 {message, reason_code}. */
class ServiceUnavailable extends HttpException
{
    public function __construct(public readonly string $reasonCode, string $message)
    {
        parent::__construct(403, $message);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'reason_code' => $this->reasonCode], 403);
    }
}
