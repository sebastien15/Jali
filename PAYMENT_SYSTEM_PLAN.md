# JALI: Configurable Payment System Implementation Plan

> **Status:** Approved — awaiting implementation  
> **Author:** AI Assistant + Sebastien  
> **Date:** 2026-04-13

---

## 1. Problem Statement

JALI operates on a **thin margin** (target ~200 RWF per ticket). Standard payment gateways charge ~3.5% (~112 RWF on a 3,200 RWF ticket), leaving only **88 RWF** before paying agents. With a 50/50 agent split, this results in a **net loss per ticket**.

**Current state:** Service fees, agent commissions, and payment method details are **hardcoded** throughout the app and backend. This creates:
- Inflexibility when business conditions change
- Inability to adjust pricing per terminal/station
- No way to optimize for new payment providers or fee structures
- Future surprises when MTN/Equity change their rates

**Solution:** Make **everything configurable** via superadmin settings. Nothing hardcoded except USSD dialing mechanics.

---

## 2. Design Principles

| Principle | Description |
|---|---|
| **Nothing hardcoded** | All fees, till numbers, merchant codes, commission rates come from the backend API |
| **Superadmin-controlled** | Only `superadmin` role can read/write payment settings |
| **Tiered & contextual** | Fees and commissions can vary by volume, location, and distance |
| **Graceful degradation** | If payment settings are not configured, fallback to sensible defaults (seeded values) |
| **Webhook-ready** | Payment verification flow supports both manual confirmation and future webhook integration |

---

## 3. Backend Architecture

### 3.1 New Database Model: `PaymentSetting`

A **single-row table** (enforced at model level) storing all payment configuration as JSON.

**File:** `backend/app/Models/PaymentSetting.php`  
**Migration:** `create_payment_settings_table`

```php
Schema::create("payment_settings", function (Blueprint $table) {
    $table->id();
    $table->json("config"); // Single JSON blob for flexibility
    $table->timestamps();
});
```

**JSON structure:**

```json
{
  "service_fee": {
    "base_amount": 200,
    "max_amount": 500,
    "per_km_rate": 0,
    "distance_threshold_km": 10,
    "description": "Standard service fee per ticket"
  },
  "agent_commission": {
    "default_percentage": 40,
    "tiers": [
      {
        "min_daily_bookings": 0,
        "max_daily_bookings": 50,
        "commission_percentage": 40
      },
      {
        "min_daily_bookings": 51,
        "max_daily_bookings": null,
        "commission_percentage": 50
      }
    ],
    "payout_frequency": "monthly",
    "description": "Agent gets X% of service fee"
  },
  "payment_methods": {
    "momo": {
      "enabled": true,
      "provider": "mtn",
      "merchant_code": "123456",
      "merchant_name": "JALI",
      "ussd_template": "*182*8*1*{MERCHANT_CODE}*{AMOUNT}#",
      "fee_percentage": 0,
      "description": "MTN MoMo direct"
    },
    "airtel": {
      "enabled": true,
      "provider": "airtel",
      "merchant_code": "123456",
      "merchant_name": "JALI",
      "ussd_template": "*500*1*{MERCHANT_CODE}*{AMOUNT}#",
      "fee_percentage": 0,
      "description": "Airtel Money direct"
    },
    "equity_till": {
      "enabled": false,
      "till_number": "123456",
      "till_name": "JALI",
      "ussd_template": "*182*8*1*{TILL_NUMBER}#",
      "fee_percentage": 0,
      "description": "Equity EazzyPay Till"
    },
    "card": {
      "enabled": false,
      "convenience_fee_type": "fixed",
      "convenience_fee_value": 100,
      "fee_percentage": 0,
      "description": "Visa/Mastercard (UI placeholder)"
    },
    "pay_at_station": {
      "enabled": true,
      "description": "Pay cash at the terminal"
    }
  },
  "booking": {
    "require_payment_upfront": true,
    "auto_expire_minutes": 15,
    "max_tickets_per_booking": 4
  }
}
```

### 3.2 Migration

**File:** `backend/database/migrations/2026_04_13_create_payment_settings_table.php`

```php
public function up(): void {
    Schema::create("payment_settings", function (Blueprint $table) {
        $table->id();
        $table->json("config");
        $table->timestamps();
    });
}

public function down(): void {
    Schema::dropIfExists("payment_settings");
}
```

### 3.3 Seeder

**File:** `backend/database/seeders/PaymentSettingsSeeder.php`

```php
class PaymentSettingsSeeder extends Seeder
{
    public function run(): void
    {
        // Only seed if no payment settings exist
        if (!\App\Models\PaymentSetting::exists()) {
            \App\Models\PaymentSetting::create([
                "config" => [
                    "service_fee" => [
                        "base_amount" => 200,
                        "max_amount" => 500,
                        "per_km_rate" => 0,
                        "distance_threshold_km" => 10,
                        "description" => "Standard service fee per ticket"
                    ],
                    "agent_commission" => [
                        "default_percentage" => 40,
                        "tiers" => [
                            [
                                "min_daily_bookings" => 0,
                                "max_daily_bookings" => 50,
                                "commission_percentage" => 40
                            ],
                            [
                                "min_daily_bookings" => 51,
                                "max_daily_bookings" => null,
                                "commission_percentage" => 50
                            ]
                        ],
                        "payout_frequency" => "monthly"
                    ],
                    "payment_methods" => [
                        "momo" => [
                            "enabled" => true,
                            "provider" => "mtn",
                            "merchant_code" => "123456",
                            "merchant_name" => "JALI",
                            "ussd_template" => "*182*8*1*{MERCHANT_CODE}*{AMOUNT}#",
                            "fee_percentage" => 0
                        ],
                        "airtel" => [
                            "enabled" => true,
                            "provider" => "airtel",
                            "merchant_code" => "789012",
                            "merchant_name" => "JALI",
                            "ussd_template" => "*500*1*{MERCHANT_CODE}*{AMOUNT}#",
                            "fee_percentage" => 0
                        ],
                        "equity_till" => [
                            "enabled" => false,
                            "till_number" => "987654",
                            "till_name" => "JALI",
                            "ussd_template" => "*182*8*1*{TILL_NUMBER}#",
                            "fee_percentage" => 0
                        ],
                        "card" => [
                            "enabled" => false,
                            "convenience_fee_type" => "fixed",
                            "convenience_fee_value" => 100,
                            "fee_percentage" => 0
                        ],
                        "pay_at_station" => [
                            "enabled" => true
                        ]
                    ],
                    "booking" => [
                        "require_payment_upfront" => true,
                        "auto_expire_minutes" => 15,
                        "max_tickets_per_booking" => 4
                    ]
                ]
            ]);
        }
    }
}
```

### 3.4 Model

**File:** `backend/app/Models/PaymentSetting.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentSetting extends Model
{
    protected $fillable = ["config"];

    protected $casts = [
        "config" => "array",
    ];

    /**
     * Get the singleton instance. Creates one if it doesn't exist.
     */
    public static function getConfig(): array
    {
        $settings = self::first();
        if (!$settings) {
            // Fallback to defaults (seeded values)
            return self::defaultConfig();
        }
        return $settings->config;
    }

    /**
     * Get enabled payment methods as a keyed array.
     */
    public static function getEnabledMethods(): array
    {
        $config = self::getConfig();
        $methods = $config["payment_methods"] ?? [];
        return array_filter($methods, fn($m) => ($m["enabled"] ?? false));
    }

    /**
     * Calculate service fee based on context (distance, station, etc.)
     */
    public static function calculateServiceFee(array $context = []): int
    {
        $config = self::getConfig();
        $sf = $config["service_fee"] ?? [];
        $base = (int) ($sf["base_amount"] ?? 200);
        $max = (int) ($sf["max_amount"] ?? 500);

        // If distance is provided, calculate additional fee
        if (isset($context["distance_km"]) && isset($sf["distance_threshold_km"])) {
            $threshold = (int) $sf["distance_threshold_km"];
            $perKm = (float) ($sf["per_km_rate"] ?? 0);
            if ($context["distance_km"] > $threshold && $perKm > 0) {
                $extra = ($context["distance_km"] - $threshold) * $perKm;
                return min($base + (int) $extra, $max);
            }
        }

        return $base;
    }

    /**
     * Calculate agent commission percentage based on their daily booking count.
     */
    public static function getAgentCommissionPercentage(int $dailyBookings = 0): float
    {
        $config = self::getConfig();
        $ac = $config["agent_commission"] ?? [];
        $default = (float) ($ac["default_percentage"] ?? 40);

        foreach (($ac["tiers"] ?? []) as $tier) {
            $min = (int) ($tier["min_daily_bookings"] ?? 0);
            $max = $tier["max_daily_bookings"] ?? null;
            if ($dailyBookings >= $min && ($max === null || $dailyBookings <= $max)) {
                return (float) $tier["commission_percentage"];
            }
        }

        return $default;
    }

    /**
     * Generate USSD string for a given payment method and amount.
     */
    public static function buildUssdString(string $method, int $amount): ?string
    {
        $config = self::getConfig();
        $methods = $config["payment_methods"] ?? [];
        $m = $methods[$method] ?? null;

        if (!$m || !($m["enabled"] ?? false)) {
            return null;
        }

        $template = $m["ussd_template"] ?? null;
        if (!$template) {
            return null;
        }

        $template = str_replace("{AMOUNT}", $amount, $template);
        $template = str_replace("{MERCHANT_CODE}", $m["merchant_code"] ?? "", $template);
        $template = str_replace("{TILL_NUMBER}", $m["till_number"] ?? "", $template);

        return $template;
    }

    /**
     * Calculate card convenience fee.
     */
    public static function getCardConvenienceFee(int $ticketPrice): int
    {
        $config = self::getConfig();
        $card = $config["payment_methods"]["card"] ?? [];
        if (!($card["enabled"] ?? false)) {
            return 0;
        }

        $type = $card["convenience_fee_type"] ?? "fixed";
        $value = (float) ($card["convenience_fee_value"] ?? 100);

        if ($type === "percentage") {
            return (int) ceil($ticketPrice * ($value / 100));
        }

        return (int) $value;
    }

    public static function defaultConfig(): array
    {
        return [
            "service_fee" => [
                "base_amount" => 200,
                "max_amount" => 500,
                "per_km_rate" => 0,
                "distance_threshold_km" => 10,
            ],
            "agent_commission" => [
                "default_percentage" => 40,
                "tiers" => [
                    ["min_daily_bookings" => 0, "max_daily_bookings" => 50, "commission_percentage" => 40],
                    ["min_daily_bookings" => 51, "max_daily_bookings" => null, "commission_percentage" => 50],
                ],
                "payout_frequency" => "monthly",
            ],
            "payment_methods" => [
                "momo" => ["enabled" => true, "provider" => "mtn", "merchant_code" => "123456", "merchant_name" => "JALI", "ussd_template" => "*182*8*1*{MERCHANT_CODE}*{AMOUNT}#", "fee_percentage" => 0],
                "airtel" => ["enabled" => true, "provider" => "airtel", "merchant_code" => "789012", "merchant_name" => "JALI", "ussd_template" => "*500*1*{MERCHANT_CODE}*{AMOUNT}#", "fee_percentage" => 0],
                "equity_till" => ["enabled" => false, "till_number" => "987654", "till_name" => "JALI", "ussd_template" => "*182*8*1*{TILL_NUMBER}#", "fee_percentage" => 0],
                "card" => ["enabled" => false, "convenience_fee_type" => "fixed", "convenience_fee_value" => 100, "fee_percentage" => 0],
                "pay_at_station" => ["enabled" => true],
            ],
            "booking" => [
                "require_payment_upfront" => true,
                "auto_expire_minutes" => 15,
                "max_tickets_per_booking" => 4,
            ],
        ];
    }
}
```

### 3.5 New Permission: `manage-payment-settings`

Add to `RolesAndPermissionsSeeder`:

```php
// New permission
Permission::firstOrCreate(["name" => "manage-payment-settings"]);
```

Assign to superadmin:
```php
$superadminRole->permissions()->syncWithoutDetaching([
    Permission::where("name", "manage-payment-settings")->first()->id,
]);
```

### 3.6 New API Controller

**File:** `backend/app/Http/Controllers/Admin/AdminPaymentSettingsController.php`

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentSetting;
use Illuminate\Http\Request;

class AdminPaymentSettingsController extends Controller
{
    /**
     * GET /admin/payment-settings
     * Returns current payment configuration.
     */
    public function index()
    {
        return response()->json(PaymentSetting::getConfig());
    }

    /**
     * POST /admin/payment-settings
     * Updates payment configuration.
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            "config" => "required|array",
            "config.service_fee" => "array",
            "config.agent_commission" => "array",
            "config.payment_methods" => "array",
            "config.booking" => "array",
        ]);

        $setting = PaymentSetting::first();
        if (!$setting) {
            $setting = PaymentSetting::create(["config" => $validated["config"]]);
        } else {
            $setting->update(["config" => $validated["config"]]);
        }

        return response()->json($setting->config);
    }
}
```

### 3.7 Public Config Endpoint

Add a public endpoint that returns payment config (read-only) for the mobile app booking flow:

**In `routes/api.php`** inside `auth:sanctum` group:

```php
Route::get("/payment-config", function () {
    return response()->json([
        "enabled_methods" => PaymentSetting::getEnabledMethods(),
        "service_fee" => PaymentSetting::calculateServiceFee(request()->only("distance_km", "station_id")),
        "card_convenience_fee" => PaymentSetting::getCardConvenienceFee(request("ticket_price", 0)),
        "booking" => PaymentSetting::getConfig()["booking"] ?? [],
    ]);
});
```

### 3.8 Route Registration

**In `backend/routes/api.php`** — inside `auth:sanctum` middleware group:

```php
Route::middleware("permission:manage-payment-settings")->group(function () {
    Route::get("/admin/payment-settings", [AdminPaymentSettingsController::class, "index"]);
    Route::post("/admin/payment-settings", [AdminPaymentSettingsController::class, "update"]);
});

// Public (authenticated) payment config
Route::get("/payment-config", function () { ... });
```

### 3.9 Register Seeder

Add `PaymentSettingsSeeder::class` to `DatabaseSeeder.php`.

---

## 4. Mobile App Architecture

### 4.1 Payment Settings Screen (Superadmin Only)

**File:** `mobile/app/(admin)/payment-settings.tsx`

A form-based screen where superadmin can:

#### Section 1: Service Fee
| Field | Type | Default |
|---|---|---|
| Base amount | Number input | 200 |
| Max amount | Number input | 500 |
| Per km rate (RWF) | Number input | 0 |
| Distance threshold (km) | Number input | 10 |

#### Section 2: Agent Commission
| Field | Type | Default |
|---|---|---|
| Default percentage | Number input | 40 |
| Payout frequency | Dropdown: per_ticket / weekly / monthly | monthly |
| Tiers | Dynamic list (add/remove rows) | 2 tiers |

Each tier row:
- Min daily bookings (number)
- Max daily bookings (number, or "unlimited")
- Commission percentage (number)

#### Section 3: Payment Methods
Each method has a **toggle switch** + expandable settings:

**MoMo:**
- Enabled: toggle
- Provider: dropdown (mtn / airtel)
- Merchant code: text input
- Merchant name: text input
- USSD template: text input (with placeholders)
- Fee %: number input

**Airtel Money:**
- Same structure as MoMo

**Equity EazzyPay Till:**
- Enabled: toggle
- Till number: text input
- Till name: text input
- USSD template: text input

**Card (Visa/Mastercard):**
- Enabled: toggle
- Convenience fee type: dropdown (fixed / percentage)
- Convenience fee value: number input

**Pay at Station:**
- Enabled: toggle

#### Section 4: Booking Settings
| Field | Type | Default |
|---|---|---|
| Require payment upfront | Toggle | true |
| Auto-expire (minutes) | Number input | 15 |
| Max tickets per booking | Number input | 4 |

### 4.2 Admin Dashboard Tile

Add a **"Payment Settings"** tile on the admin dashboard, visible only to `isSuperAdmin`:

```tsx
{isSuperAdmin && (
  <Tile
    icon="settings-outline"
    label="Payment Settings"
    onPress={() => router.push("/(admin)/payment-settings")}
  />
)}
```

### 4.3 Booking Flow Update

**File:** `mobile/components/BookingSheet.tsx` and `mobile/components/TripBookingSheet.tsx`

1. **Fetch payment config** on sheet open: `GET /payment-config?ticket_price={price}`
2. **Render enabled payment methods** as selectable options (not hardcoded)
3. **For each method**, show:
   - Method name + icon
   - Any applicable fees (card convenience fee, etc.)
   - Total amount
4. **When user selects a method** that uses USSD:
   - Call `GET /payment-config` to get USSD string for the selected method
   - Use `Linking.openURL("tel:{USSD_STRING}")` on mobile to open dialer
   - Show "I've paid" button after USSD is dialed
   - On "I've paid" → mark booking as `pending_payment` → admin confirms

### 4.4 New API Service Layer

**File:** `mobile/lib/paymentConfig.ts`

```ts
import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "jali_payment_config";

export interface PaymentMethodConfig {
  enabled: boolean;
  provider?: string;
  merchant_code?: string;
  merchant_name?: string;
  till_number?: string;
  till_name?: string;
  ussd_template?: string;
  convenience_fee_type?: "fixed" | "percentage";
  convenience_fee_value?: number;
  fee_percentage?: number;
  description?: string;
}

export interface PaymentConfig {
  service_fee: number;
  card_convenience_fee: number;
  enabled_methods: Record<string, PaymentMethodConfig>;
  booking: {
    require_payment_upfront: boolean;
    auto_expire_minutes: number;
    max_tickets_per_booking: number;
  };
}

let cachedConfig: PaymentConfig | null = null;

export async function getPaymentConfig(): Promise<PaymentConfig> {
  // Return cached version if available
  if (cachedConfig) return cachedConfig;

  // Try AsyncStorage cache (last 5 minutes)
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        cachedConfig = data;
        return data;
      }
    }
  } catch {}

  // Fetch from API
  const res = await api.get("/payment-config");
  cachedConfig = res.data;

  // Cache in AsyncStorage
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: res.data, timestamp: Date.now() })
    );
  } catch {}

  return res.data;
}

/**
 * Build USSD string from template and amount.
 */
export function buildUssdString(methodKey: string, amount: number): string | null {
  const method = cachedConfig?.enabled_methods?.[methodKey];
  if (!method || !method.ussd_template) return null;

  let template = method.ussd_template;
  template = template.replace("{AMOUNT}", String(amount));
  template = template.replace("{MERCHANT_CODE}", method.merchant_code ?? "");
  template = template.replace("{TILL_NUMBER}", method.till_number ?? "");
  return template;
}

/**
 * Clear cached config (after superadmin updates settings).
 */
export async function clearPaymentConfigCache(): Promise<void> {
  cachedConfig = null;
  await AsyncStorage.removeItem(CACHE_KEY);
}
```

### 4.5 USSD Dialer Utility

**File:** `mobile/lib/ussd.ts`

```ts
import { Linking, Platform, Alert } from "react-native";

export async function dialUssd(ussd: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      Alert.alert(
        "Payment Required",
        `Please dial this USSD code on your phone:\n\n${ussd}\n\nThen return to the app and tap "I've paid".`
      );
      return true;
    }

    // On mobile, open the phone dialer
    const url = Platform.OS === "android"
      ? `tel:${encodeURIComponent(ussd)}`
      : `telprompt:${ussd}`; // iOS requires telprompt for USSD with #

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }

    Alert.alert("Cannot dial USSD", `Please manually dial: ${ussd}`);
    return false;
  } catch {
    Alert.alert("Error", "Could not open dialer. Please manually dial the USSD code.");
    return false;
  }
}
```

### 4.6 Payment Method Selector Component

**File:** `mobile/components/PaymentMethodSelector.tsx`

A reusable component used in booking sheets:

```tsx
<PaymentMethodSelector
  config={paymentConfig}
  ticketPrice={trip.price}
  selectedMethod={selectedPayment}
  onSelect={(method) => setSelectedPayment(method)}
/>
```

Renders each enabled method as a card with:
- Icon + name
- Fee breakdown (e.g., "+100 RWF card fee")
- Total price
- Radio button for selection

---

## 5. Booking Flow Diagram

```
User selects trip → Booking Sheet opens
                        ↓
              Fetch /payment-config
                        ↓
        Show payment method options (dynamic)
                        ↓
        User selects payment method
                        ↓
        ┌─────────────────────────────────┐
        │  If USSD-based (MoMo/Airtel/    │
        │  Equity):                       │
        │    1. Build USSD string         │
        │    2. Open dialer (tel:USSD)    │
        │    3. Show "I've paid" button   │
        │    4. User taps → booking saved │
        │       as pending_payment        │
        │                                 │
        │  If Pay at Station:             │
        │    1. Booking saved directly    │
        │       as pending_payment        │
        │                                 │
        │  If Card (future):              │
        │    1. Redirect to gateway       │
        │    2. Webhook confirms payment  │
        └─────────────────────────────────┘
                        ↓
          Admin sees pending booking
                        ↓
          Admin confirms & uploads ticket
                        ↓
          User receives confirmed booking
```

---

## 6. Future: Webhook Integration

When MTN MoMo, Airtel, or Equity provides a webhook/callback API:

1. **Add webhook endpoint** in Laravel:
   ```php
   Route::post("/webhooks/payment", [PaymentWebhookController::class, "handle"]);
   ```
2. **Payment webhook controller** matches transaction ID to pending booking
3. **Auto-confirm** booking without admin intervention
4. **Payment settings** can include webhook secret, callback URL, etc.

The current USSD manual flow is fully compatible — the webhook just automates step 4.

---

## 7. Files to Create/Modify

### Backend (Laravel)
| File | Action |
|---|---|
| `database/migrations/2026_04_13_create_payment_settings_table.php` | **Create** |
| `database/seeders/PaymentSettingsSeeder.php` | **Create** |
| `database/seeders/DatabaseSeeder.php` | **Modify** — add seeder call |
| `database/seeders/RolesAndPermissionsSeeder.php` | **Modify** — add `manage-payment-settings` permission |
| `app/Models/PaymentSetting.php` | **Create** |
| `app/Http/Controllers/Admin/AdminPaymentSettingsController.php` | **Create** |
| `routes/api.php` | **Modify** — add routes |

### Mobile (Expo)
| File | Action |
|---|---|
| `lib/paymentConfig.ts` | **Create** — config fetching + cache |
| `lib/ussd.ts` | **Create** — USSD dialer utility |
| `components/PaymentMethodSelector.tsx` | **Create** — payment method cards |
| `app/(admin)/payment-settings.tsx` | **Create** — superadmin settings form |
| `app/(admin)/dashboard.tsx` | **Modify** — add Payment Settings tile |
| `components/BookingSheet.tsx` | **Modify** — dynamic payment options |
| `components/TripBookingSheet.tsx` | **Modify** — dynamic payment options |

---

## 8. Implementation Order

### Phase 1: Foundation (Backend)
1. Create migration + run it
2. Create `PaymentSetting` model
3. Create seeder with default values
4. Add permission + role seeder update
5. Create controller
6. Register routes
7. Add `GET /payment-config` public endpoint
8. Run `php artisan migrate:fresh --seed` to test

### Phase 2: Admin Settings Screen (Mobile)
1. Create `lib/paymentConfig.ts` — config fetching
2. Create `app/(admin)/payment-settings.tsx` — full form
3. Add dashboard tile for superadmin
4. Test CRUD on payment settings

### Phase 3: Booking Flow Integration (Mobile)
1. Create `lib/ussd.ts` — USSD dialer
2. Create `components/PaymentMethodSelector.tsx`
3. Update `BookingSheet.tsx` to use dynamic config
4. Update `TripBookingSheet.tsx` to use dynamic config
5. Test end-to-end booking with USSD flow

### Phase 4: Polish
1. Add loading states, error handling
2. Cache invalidation when superadmin updates settings
3. Add confirmation dialogs for destructive changes
4. Add "Reset to defaults" button in admin settings

---

## 9. Edge Cases & Considerations

| Scenario | Handling |
|---|---|
| No payment settings in DB | `PaymentSetting::getConfig()` falls back to `defaultConfig()` |
| Superadmin disables all payment methods | Show error in admin UI; prevent disabling the last enabled method |
| USSD code contains `#` on iOS | Use `telprompt:` scheme instead of `tel:` to preserve `#` |
| User on web (can't dial USSD) | Show USSD code as text with instructions |
| Agent has 0 bookings today | Falls back to default percentage tier |
| Distance not provided for service fee | Returns base amount |
| Card convenience fee as percentage > 100% | Cap at reasonable maximum (e.g., 10%) |
| Concurrent superadmin edits | Last write wins (single row, no conflict resolution needed for MVP) |

---

## 10. Testing Checklist

- [ ] `migrate:fresh --seed` creates payment settings with correct defaults
- [ ] `GET /admin/payment-settings` returns config (superadmin only)
- [ ] `POST /admin/payment-settings` updates config (superadmin only)
- [ ] `GET /payment-config` returns enabled methods (any authenticated user)
- [ ] Service fee calculation respects base/max/distance
- [ ] Agent commission tiers calculate correctly
- [ ] USSD string builds correctly with template substitution
- [ ] Card convenience fee calculates for both fixed and percentage types
- [ ] Admin settings screen loads, edits, and saves correctly
- [ ] Booking sheet shows correct payment methods
- [ ] USSD dialer opens on mobile, shows code on web
- [ ] Disabling a payment method in admin removes it from booking sheet
- [ ] Cache invalidates when settings are updated

---

## 11. Notes for Future Implementation

- **Verify Equity EazzyPay 0% fee**: Many "0% merchant fees" have hidden costs or volume requirements. The configurable system means you can adjust the `fee_percentage` anytime without code changes.
- **MTN MoMo under 4,000 RWF free tier**: Confirm with MTN Rwanda before relying on this. The system is flexible enough to add a `fee_percentage` later.
- **Agent payout batching**: Start with per-ticket simplicity. Add weekly/monthly batch payout logic in Phase 4 or later.
- **Card gateway**: The card method is a UI placeholder. When integrating a real gateway (e.g., Stripe, Flutterwave), add the gateway config fields to the payment settings JSON and implement the webhook flow.
- **Dynamic pricing by station/terminal**: The `calculateServiceFee()` method accepts a `station_id` context. You can add station-specific fee overrides in the JSON config later without code changes.
