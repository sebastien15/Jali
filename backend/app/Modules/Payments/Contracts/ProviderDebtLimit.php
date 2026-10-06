<?php

namespace App\Modules\Payments\Contracts;

/** Does a provider owe Jali more than the configured limit (S5.4)? */
interface ProviderDebtLimit
{
    public function isOverLimit(int $userId): bool;
}
