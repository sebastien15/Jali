# JALI: Profit Maximization & Financial Efficiency Strategy

> **Last updated:** 2026-04-13  
> **Status:** Living document — all values are configurable by superadmin, nothing is hardcoded.

---

## 1. The "Thin Margin" Challenge

* **Base Service Fee:** 200 RWF per ticket (configurable).
* **Dynamic Service Fee:** Adjusts based on distance from terminal and station-specific volume.
  * Base: 200 RWF (configurable)
  * Max: 500 RWF (configurable)
  * Distance threshold: 10 km (configurable) — users beyond this may pay more
  * Per-terminal overrides possible
* **Average Ticket Price:** 3,000 – 4,500 RWF.
* **The Risk:** Standard payment gateways (3.5%) charge ~112 RWF per transaction, leaving JALI with only **88 RWF** before paying Terminal Agents.

**Key principle:** No value is hardcoded. All fees, thresholds, and percentages are managed by the superadmin via the dashboard payment settings.

---

## 2. Solution: Zero-Leakage Payment Architecture

### A. Primary Channel: USSD-Based Payments

Instead of expensive third-party aggregator APIs, JALI uses **USSD dialing** with pre-filled amounts. This is free to implement and works on any phone.

**Supported methods (all configurable):**

| Method | USSD Pattern | Provider |
|---|---|---|
| **MTN MoMo** | `*182*8*1*{MERCHANT_CODE}*{AMOUNT}#` | MTN Rwanda |
| **Airtel Money** | `*500*1*{MERCHANT_CODE}*{AMOUNT}#` | Airtel Rwanda |
| **Equity EazzyPay Till** | `*182*8*1*{TILL_NUMBER}#` | Equity Bank |
| **Pay at Station** | N/A (cash at terminal) | — |
| **Card (Visa/Mastercard)** | UI placeholder only (future gateway integration) | TBD |

**Why USSD over API integration:**
- Zero API cost — no gateway fees per transaction
- Works on any phone (no smartphone required)
- Customer dials the code → enters PIN → payment confirmed
- JALI saves **~100 RWF per transaction** compared to aggregator gateways

**Configuration:** Each method can be enabled/disabled by superadmin. Merchant codes, till numbers, and USSD templates are all editable in settings.

### B. Equity EazzyPay Integration

JALI can use **Equity Bank's EazzyPay Till** system as a primary receiving channel.

* **Why:** It is interoperable. Customers with MTN MoMo or Airtel Money can pay into an Equity Till via USSD.
* **Profit Impact:**
  * Merchant Fee: **~0%** (for most local merchant payments — verify with Equity).
  * Settlement: Money lands directly in the JALI Equity Bank account.
  * Savings: **~100 RWF saved** per transaction compared to international gateways.
* **Note:** Many "0% merchant fees" have hidden costs or minimum volume requirements. The configurable `fee_percentage` field means you can adjust this anytime without code changes.

### C. MoMo Pay Strategy (MTN / Airtel)

Register JALI as a **Micro-Merchant** with MTN Rwanda and Airtel Rwanda.

* MTN Rwanda often waives or significantly reduces merchant commissions for transactions under **4,000 RWF**.
* **Action:** Obtain merchant codes from both providers.
* **Profit Impact:** Reduces the commission from the standard 0.5% to near **0%**, protecting the full service fee margin.
* **Note:** Confirm with MTN Rwanda before relying on the free-tier. The system is flexible enough to add a `fee_percentage` later without code changes.

### D. Card Payment Offset (Visa/Mastercard)

Card payments are expensive (2.5% – 3.5% fee).

* **Solution:** Implement a configurable **Convenience Fee** for card users.
  * Fee type: Fixed amount (e.g., +100 RWF) or percentage (e.g., +3%) — set by superadmin.
  * Default: +100 RWF fixed.
* **Logic:** The customer pays the "Bank Tax" for using a card, keeping JALI's margin untouched.
* **Current status:** UI placeholder only. Real card gateway integration (Stripe, Flutterwave, etc.) is a future phase.

---

## 3. Operational Efficiency Solutions

### A. Terminal Agent Commission — Tiered & Configurable

Agent commission is **not a flat rate**. It scales based on:

1. **Daily booking volume tiers:**
   * 0–50 bookings/day: **40%** of service fee
   * 51+ bookings/day: **50%** of service fee
   * Tiers are fully configurable — superadmin can add, remove, or modify them.

2. **Terminal-specific differences:**
   * High-volume terminals (e.g., Kigali main station) may have different commission rates than low-volume terminals.
   * Superadmin can set overrides per station.

3. **Payout frequency:**
   * Options: Per-ticket, weekly batch, or monthly batch.
   * Default: Monthly batch (avoids transfer fees on every single payout).
   * Start with per-ticket for simplicity, migrate to batch later.

**Savings:** Batch payouts avoid the 20–100 RWF MoMo transfer fee on every single split.

### B. Dynamic Service Fee by Distance

Service fee adapts to how far the user is from the departure terminal:

| Distance from Terminal | Service Fee |
|---|---|
| 0–10 km (default threshold) | Base fee (200 RWF) |
| 10+ km | Base + per-km rate (capped at max fee, e.g., 500 RWF) |

All values (base, max, threshold, per-km rate) are configurable by superadmin.

### C. Asset-Light Scale

* **No Hardware:** Agents use their own smartphones.
* **Zero Engineering Overhead:** Built in-house (Founding Team).
* **Cloud Cost Optimization:** Use a "Pay-as-you-go" backend so server costs only grow as ticket sales grow.

---

## 4. Payment Flow

```
User selects trip → Booking Sheet opens
                        ↓
              Fetch /payment-config (dynamic)
                        ↓
        Show enabled payment methods (from settings)
                        ↓
        User selects payment method (MoMo/Airtel/Till/Card/Pay at Station)
                        ↓
        ┌─────────────────────────────────────────┐
        │  If USSD-based (MoMo/Airtel/Equity):    │
        │    1. App builds USSD string from       │
        │       template + merchant code + amount  │
        │    2. Opens phone dialer (tel:USSD)      │
        │    3. USSD code is pre-filled with       │
        │       amount — user just confirms + PIN  │
        │    4. User returns to app → taps         │
        │       "I've paid" → booking saved        │
        │       as pending_payment                 │
        │                                         │
        │  If Pay at Station:                     │
        │    Booking saved as pending_payment      │
        │                                         │
        │  If Card (future):                      │
        │    Redirect to payment gateway           │
        │    Webhook confirms payment              │
        └─────────────────────────────────────────┘
                        ↓
          Admin sees pending booking in dashboard
                        ↓
          Admin confirms payment → uploads ticket
                        ↓
          User receives confirmed booking + ticket
```

**Future: Webhook automation.** When MTN/Airtel/Equity provides a webhook, the app auto-confirms bookings without manual admin intervention.

---

## 5. Superadmin Payment Settings Dashboard

All payment configuration lives in the **admin dashboard** (superadmin only). Nothing is hardcoded in code.

### Configurable Sections

| Section | Fields | Default Values |
|---|---|---|
| **Service Fee** | Base amount, Max amount, Per-km rate, Distance threshold (km) | 200 RWF / 500 RWF / 0 RWF / 10 km |
| **Agent Commission** | Default %, Volume tiers (min bookings, max bookings, %), Payout frequency | 40% / 0–50→40%, 51+→50% / Monthly |
| **MoMo** | Enabled, Merchant code, Merchant name, USSD template, Fee % | Yes / 123456 / JALI / `*182*8*1*{CODE}*{AMOUNT}#` / 0% |
| **Airtel Money** | Enabled, Merchant code, Merchant name, USSD template, Fee % | Yes / 789012 / JALI / `*500*1*{CODE}*{AMOUNT}#` / 0% |
| **Equity Till** | Enabled, Till number, Till name, USSD template, Fee % | No / 987654 / JALI / `*182*8*1*{TILL}#` / 0% |
| **Card** | Enabled, Fee type (fixed/%), Fee value | No / Fixed / 100 RWF |
| **Pay at Station** | Enabled | Yes |
| **Booking** | Require payment upfront, Auto-expire (min), Max tickets per booking | Yes / 15 min / 4 |

---

## 6. Revenue Comparison Table

| Feature | Standard Aggregator (DPO/Flutterwave) | JALI Optimized Strategy (USSD/Direct) |
| :--- | :--- | :--- |
| **Gross Service Fee** | 200 RWF | 200 RWF (configurable, up to 500 RWF) |
| **Payment Gateway Fee** | -112 RWF (3.5%) | **-0 RWF** (USSD dialing is free) |
| **Withdrawal to Bank** | -500 RWF (per batch) | **-0 RWF** (direct to Equity account) |
| **Agent Share (40% default)** | -80 RWF | -80 RWF (scales to 50% at 50+ bookings/day) |
| **Net Profit per Ticket** | **-92 RWF (LOSS)** | **+120 RWF (PROFIT)** |

---

## 7. Conclusion

To survive on a thin margin, JALI cannot behave like a global tech company; it must behave like a **local financial merchant**.

**Core strategy:**
1. Eliminate payment gateway middlemen by using **USSD dialing** instead of API integrations.
2. Integrate directly with **Equity Bank** EazzyPay and **MTN/Airtel merchant codes** to route money with zero fees.
3. Pass card processing costs to card users via configurable convenience fees.
4. Scale agent commissions based on volume and terminal — reward high performers, protect margins.
5. Make **everything configurable** — no hardcoded values, no surprises when providers change their rates.

**All values are managed by the superadmin in the dashboard. The code adapts automatically.**
