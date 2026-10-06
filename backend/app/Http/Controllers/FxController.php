<?php

namespace App\Http\Controllers;

use App\Modules\Payments\Application\ExchangeRates;

/** GET /fx/rates — approximate RWF conversions for visitors (story S9.4) */
class FxController extends Controller
{
    public function rates(ExchangeRates $fx)
    {
        return response()->json($fx->current());
    }
}
