# Stack: Laravel 11 API
> Rules for every controller, route, model, or migration in `backend/`.
> Stack: Laravel 11, Sanctum, MySQL (prod), SQLite (dev), Redis (prod cache/queue).

---

## Auth & Security (MANDATORY — no exceptions)

### Every route needs `auth:sanctum` except login/OTP
```php
// Public — only these 4:
Route::post("/auth/login", ...);
Route::post("/auth/login/google", ...);
Route::post("/auth/otp/request", ...);
Route::post("/auth/otp/verify", ...);

// Everything else MUST be inside:
Route::middleware("auth:sanctum")->group(function () {
    // Role-restricted endpoints add permission middleware:
    Route::middleware("permission:manage-users")->group(function () { ... });
});
```

### Controllers must also check role (defense-in-depth)
```php
// Middleware catches it first, but controllers verify too:
$user = $request->user();
if (!$user->isAdmin()) return response()->json(["error" => "Forbidden"], 403);
```

### Token lifecycle
- Create: `$user->createToken("api-token")->plainTextToken`
- Revoke on logout: `$request->user()->currentAccessToken()->delete()`
- Never return raw token after login again — it's one-time

---

## Pagination — Always Use Cursor Pagination

```php
// ❌ NEVER — unbounded collection
return User::all();

// ❌ AVOID for large sets — OFFSET slows down as page number grows
return Booking::paginate(25);

// ✅ BEST — cursor pagination (no OFFSET, stays fast at 100k+ records)
return Trip::cursorPaginate(25);
```

### Why cursor over offset?
Offset pagination (`LIMIT 25 OFFSET 500`) scans and discards 500 rows every time.
Cursor pagination uses `WHERE id > :cursor LIMIT 25` — equally fast on page 1 or page 1000.

**This is the right choice for Jali because:**
- Trips, listings, bookings don't change between the user's scroll session
- Users scroll linearly (no "jump to page 15")
- Combined with `useInfiniteQuery` on mobile, the cursor flows automatically

### Laravel cursor response shape
```json
{
  "data": [...],
  "path": "https://...",
  "per_page": 25,
  "next_cursor": "eyJpZCI6MTAwfQ",   // base64 cursor
  "next_page_url": "...?cursor=eyJ...",
  "prev_cursor": null
}
```

Mobile reads `next_cursor` via `getNextPageParam` in `useInfiniteQuery`.

---

## Caching — Redis Required in Production

### Fragment caching for expensive queries
```php
// Cache analytics, stats, aggregations — not individual records
$stats = Cache::remember("admin.earnings.{$user->id}", 120, function () use ($user) {
    return [
        "total"   => Booking::where("admin_id", $user->id)->sum("amount"),
        "pending" => Booking::where("admin_id", $user->id)->pending()->count(),
    ];
});
```

### Cache tags for grouped invalidation
```php
// Store with tag
Cache::tags(["trips"])->remember("trips.all", 60, fn() => Trip::active()->get());

// Bust all trip caches at once after any trip mutation
Cache::tags(["trips"])->flush();
```

### HTTP Cache-Control headers on every read endpoint
```php
// Public shared data (trips, stations, car-rentals):
return response()->json($data)
    ->header("Cache-Control", "public, max-age=60, stale-while-revalidate=30");

// Private user data (bookings, /me, profile):
return response()->json($data)
    ->header("Cache-Control", "private, no-store");

// Admin analytics:
return response()->json($data)
    ->header("Cache-Control", "private, max-age=120");
```

Never skip Cache-Control. Default = no caching = every request hits the DB.

---

## API Resources — Lean Responses

```php
// List view — minimal fields
class TripListResource extends JsonResource {
    public function toArray($request): array {
        return [
            "id"           => $this->id,
            "from"         => $this->fromStation->name,
            "to"           => $this->toStation->name,
            "departure"    => $this->departure_time,
            "price"        => $this->price,
            "seats_left"   => $this->available_seats,
            "agency"       => $this->agency->name,
            "thumbnail"    => $this->agency->thumbnail_url, // small image
        ];
    }
}

// Detail view — full data (only on tap/open)
class TripDetailResource extends JsonResource {
    public function toArray($request): array {
        return [
            ...parent::toArray($request),
            "description"   => $this->description,
            "amenities"     => $this->amenities,
            "driver"        => new DriverResource($this->driver),
            "stops"         => StopResource::collection($this->stops),
        ];
    }
}
```

Never return raw `$model->toArray()` — it includes internal fields, nulls, and timestamps the client doesn't need.

---

## N+1 Query Prevention

Always eager load relationships:
```php
// ❌ BAD — 1 + N queries
$bookings = Booking::all();
foreach ($bookings as $b) { echo $b->user->name; } // N queries

// ✅ GOOD — 2 queries total
$bookings = Booking::with(["user:id,name,email", "trip.fromStation", "trip.toStation"])
    ->select(["id", "user_id", "trip_id", "status", "created_at"])
    ->latest()
    ->cursorPaginate(25);
```

Use `select()` to return only needed columns. Use `with("relation:id,name")` to limit relation columns.

Install in dev to catch N+1 before production:
```bash
composer require barryvdh/laravel-debugbar --dev
```

---

## Rate Limiting (Per User, Not Per IP)

Rwanda mobile networks share IP ranges — IP-based limits will ban legitimate users.

```php
// bootstrap/app.php or AppServiceProvider
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for("search", fn($req) =>
    Limit::perMinute(30)->by($req->user()?->id ?? $req->ip())
);
RateLimiter::for("bookings", fn($req) =>
    Limit::perMinute(5)->by($req->user()?->id ?? $req->ip())
);
RateLimiter::for("admin-actions", fn($req) =>
    Limit::perMinute(20)->by($req->user()?->id ?? $req->ip())
);

// Apply in routes:
Route::middleware(["auth:sanctum", "throttle:search"])->get("/trips", ...);
Route::middleware(["auth:sanctum", "throttle:bookings"])->post("/bookings", ...);
```

Standard limits:
| Endpoint | Limit |
|---|---|
| `/trips` search | 30/min/user |
| `POST /bookings` | 5/min/user |
| `PATCH /admin/bookings/:id` | 20/min/user |
| `/me` | 10/min/user |

---

## Queue Slow Work — Never Block a Response

```php
// ❌ BAD — user waits 3–5 seconds for email
public function confirmBooking(Request $request, $id) {
    $booking->update(["status" => "confirmed"]);
    Mail::to($booking->user)->send(new BookingConfirmed($booking)); // blocks
    return response()->json($booking);
}

// ✅ GOOD — response in <100ms, email sent in background
public function confirmBooking(Request $request, $id) {
    $booking->update(["status" => "confirmed"]);
    Mail::to($booking->user)->queue(new BookingConfirmed($booking));
    ProcessBookingConfirmation::dispatch($booking); // image resize, push notif, etc.
    return response()->json($booking);
}
```

Things that MUST be queued:
- Email / SMS / push notifications
- Image resizing / thumbnail generation
- PDF generation (tickets, receipts)
- External API calls (payment webhooks)
- Booking confirmation side-effects

---

## Deployment Commands (run on every deploy)

```bash
php artisan config:cache    # compile config into single file
php artisan route:cache     # compile routes
php artisan view:cache      # compile blade views
php artisan event:cache     # compile event listeners
composer install --optimize-autoloader --no-dev
```

Production `.env` must have:
```env
APP_DEBUG=false         # CRITICAL — debug mode is 10× slower and leaks data
APP_ENV=production
CACHE_DRIVER=redis      # never 'file' in production
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
LOG_LEVEL=error
```

---

## Database Indexes — Add Before Shipping

Every filterable, sortable, or foreign key column needs an index:
```php
// migration
$table->index(["user_id", "status"]);                           // bookings list
$table->index(["from_station_id", "to_station_id", "active"]);  // trip search
$table->index("created_at");                                     // logs pagination
$table->foreignId("user_id")->constrained()->index();           // all FK columns
```

Check for missing indexes with EXPLAIN:
```sql
EXPLAIN SELECT * FROM bookings WHERE user_id = 1 AND status = 'pending';
-- If type = "ALL", you need an index
```

---

## Monitoring

Install Laravel Pulse in production:
```bash
composer require laravel/pulse
php artisan pulse:install && php artisan migrate
```

Health endpoint (no auth, no rate limit):
```php
Route::get("/health", function () {
    return response()->json([
        "status"    => "ok",
        "db"        => DB::connection()->getPdo() ? "ok" : "error",
        "redis"     => Redis::ping() === "PONG" ? "ok" : "error",
        "timestamp" => now()->toISOString(),
    ]);
})->withoutMiddleware(["throttle:api"]);
```

Key metrics thresholds:
| Metric | Warning | Critical |
|---|---|---|
| PHP-FPM worker utilization | >70% | >90% |
| MySQL avg query time | >100ms | >500ms |
| Queue depth (jobs waiting) | >100 | >1,000 |
| Laravel p95 response time | >500ms | >2,000ms |

---

## Feature Checklist — Before Marking Any Endpoint Done

- [ ] Route is inside `auth:sanctum` group (unless it's an auth endpoint)
- [ ] Role-restricted routes have `permission:<name>` middleware
- [ ] Controller also checks role (defense-in-depth)
- [ ] Response uses an API Resource (not raw model)
- [ ] List response uses `cursorPaginate(25)` — never `all()` or `paginate()` for large sets
- [ ] Relationships eager loaded with `->with()` — no N+1
- [ ] `select()` limits returned columns to what the client needs
- [ ] `Cache-Control` header set on response
- [ ] Expensive aggregations wrapped in `Cache::remember()`
- [ ] Slow operations dispatched to queue
- [ ] Filterable columns have DB indexes in migration
- [ ] Rate limiting applied to endpoint
