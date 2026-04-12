# Jali — Agencies, Trips & Booking Implementation Plan

## Codebase Overview (read this first)

- **Backend**: Laravel 11 + Sanctum, SQLite, located at `backend/`
- **Frontend**: React Native + Expo Router v6, located at `mobile/`
- **Auth**: Bearer token stored in AsyncStorage under key `"jali_api_token"` via `mobile/lib/api.ts`
- **Permissions**: `CheckPermission` middleware, seeded in `RolesAndPermissionsSeeder.php`
- **Activity logging**: `ActivityLog` model — fields: `admin_id`, `action`, `entity_type`, `entity_id`, `details` (JSON)
- **Existing booking types**: `bus`, `private`, `rental` — stored in `bookings.type`
- **Stations**: `admin_stations` table — fields: `id`, `city`, `district`, `type`, `address`, `latitude`, `longitude`, `image_url`, `user_id`
- **Admin screens**: `mobile/app/(admin)/`
- **User screens**: `mobile/app/(tabs)/`
- **Theme constants**: `import { C } from "@/constants/theme"` — colors: `C.blue`, `C.yellow`, `C.green`, `C.teal`, `C.orange`, `C.dark`, `C.mid`, `C.muted`, `C.bg`, `C.border`, `C.white`, etc.
- **API instance**: `import api from "@/lib/api"` — attaches Bearer token automatically
- **Admin navigation context**: `import { useAdminNav } from "@/components/admin/AdminNavContext"` — exposes `{ user, isSuperAdmin, loading, refetch, handleLogout }`
- **Existing booking flow**: `POST /bookings` → `{ type, reference_id, price, service_fee, payment_method, title, sub, travel_date }`
- **Translations**: 4 locale files at `mobile/locales/en.json`, `rw.json`, `fr.json`, `sw.json`

---

## STEP 1 — Database Migrations (run in this order)

### 1a. `create_agencies_table`
```php
Schema::create('agencies', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

### 1b. `create_agency_routes_table`
```php
Schema::create('agency_routes', function (Blueprint $table) {
    $table->id();
    $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
    $table->foreignId('from_station_id')->constrained('admin_stations')->cascadeOnDelete();
    $table->foreignId('to_station_id')->constrained('admin_stations')->cascadeOnDelete();
    $table->timestamps();
    $table->unique(['agency_id', 'from_station_id', 'to_station_id']);
});
```

### 1c. `create_agency_ratings_table`
```php
Schema::create('agency_ratings', function (Blueprint $table) {
    $table->id();
    $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
    $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
    $table->unsignedTinyInteger('stars'); // 1–5
    $table->text('comment')->nullable();
    $table->timestamps();
    $table->unique(['agency_id', 'user_id']); // one rating per user per agency
});
```

### 1d. `create_trips_table`
```php
Schema::create('trips', function (Blueprint $table) {
    $table->id();
    $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
    $table->foreignId('from_station_id')->constrained('admin_stations');
    $table->foreignId('to_station_id')->constrained('admin_stations');
    $table->time('departure_time');           // e.g. "08:00"
    $table->time('estimated_arrival_time');   // e.g. "11:30"
    $table->unsignedInteger('price');         // RWF, no decimals
    $table->unsignedInteger('total_seats')->default(30);
    $table->boolean('active')->default(true);
    $table->timestamps();
});
```

### 1e. `add_trip_fields_to_bookings`
```php
Schema::table('bookings', function (Blueprint $table) {
    $table->foreignId('trip_id')->nullable()->constrained('trips')->nullOnDelete()->after('location_id');
    $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete()->after('trip_id');
    $table->timestamp('confirmed_at')->nullable()->after('confirmed_by');
});
```

> After creating migrations, run: `php artisan migrate`

---

## STEP 2 — Permissions Seeder Update

In `backend/database/seeders/RolesAndPermissionsSeeder.php`, add to the `$permissions` array:
```php
'manage-agencies' => 'Create, edit and delete agencies and trips',
```

Then ensure both `superadmin` and `admin` roles receive this permission:
- `superadmin` already gets all permissions via `Permission::all()`
- For `admin`, add `'manage-agencies'` to its `whereIn` list alongside existing permissions

Run: `php artisan db:seed --class=RolesAndPermissionsSeeder`

---

## STEP 3 — Backend Models

### `backend/app/Models/Agency.php`
```php
class Agency extends Model {
    protected $fillable = ['name', 'created_by'];

    public function routes(): HasMany { return $this->hasMany(AgencyRoute::class); }
    public function ratings(): HasMany { return $this->hasMany(AgencyRating::class); }
    public function trips(): HasMany { return $this->hasMany(Trip::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }

    public function getAverageRatingAttribute(): float {
        return round($this->ratings()->avg('stars') ?? 0, 1);
    }
}
```

### `backend/app/Models/AgencyRoute.php`
```php
class AgencyRoute extends Model {
    protected $fillable = ['agency_id', 'from_station_id', 'to_station_id'];

    public function fromStation(): BelongsTo { return $this->belongsTo(AdminStation::class, 'from_station_id'); }
    public function toStation(): BelongsTo { return $this->belongsTo(AdminStation::class, 'to_station_id'); }
    public function agency(): BelongsTo { return $this->belongsTo(Agency::class); }
}
```

### `backend/app/Models/AgencyRating.php`
```php
class AgencyRating extends Model {
    protected $fillable = ['agency_id', 'user_id', 'stars', 'comment'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function agency(): BelongsTo { return $this->belongsTo(Agency::class); }
}
```

### `backend/app/Models/Trip.php`
```php
class Trip extends Model {
    protected $fillable = [
        'agency_id', 'from_station_id', 'to_station_id',
        'departure_time', 'estimated_arrival_time',
        'price', 'total_seats', 'active',
    ];

    protected function casts(): array {
        return ['active' => 'boolean'];
    }

    public function agency(): BelongsTo { return $this->belongsTo(Agency::class); }
    public function fromStation(): BelongsTo { return $this->belongsTo(AdminStation::class, 'from_station_id'); }
    public function toStation(): BelongsTo { return $this->belongsTo(AdminStation::class, 'to_station_id'); }
    public function bookings(): HasMany { return $this->hasMany(Booking::class); }
}
```

### Update `backend/app/Models/Booking.php`
Add to `$fillable`: `'trip_id'`, `'confirmed_by'`, `'confirmed_at'`
Add to `casts()`: `'confirmed_at' => 'datetime'`
Add relations:
```php
public function trip(): BelongsTo { return $this->belongsTo(Trip::class); }
public function confirmedBy(): BelongsTo { return $this->belongsTo(User::class, 'confirmed_by'); }
```

---

## STEP 4 — Backend Controllers

### `backend/app/Http/Controllers/Admin/AgencyController.php`

Implement full CRUD. All methods are behind `permission:manage-agencies` middleware.

**`index()`** — returns all agencies with routes and average rating:
```php
$agencies = Agency::with(['routes.fromStation', 'routes.toStation', 'ratings'])->get();
return response()->json($agencies->map(fn($a) => [
    'id' => $a->id,
    'name' => $a->name,
    'average_rating' => $a->average_rating,
    'ratings_count' => $a->ratings->count(),
    'routes' => $a->routes->map(fn($r) => [
        'id' => $r->id,
        'from' => ['id' => $r->fromStation->id, 'city' => $r->fromStation->city, 'district' => $r->fromStation->district],
        'to'   => ['id' => $r->toStation->id,   'city' => $r->toStation->city,   'district' => $r->toStation->district],
    ]),
]));
```

**`store()`** — validates `name` (required, string), creates Agency, logs action:
```php
$validated = $request->validate(['name' => 'required|string|max:150']);
$agency = Agency::create([...$validated, 'created_by' => $request->user()->id]);
ActivityLog::create(['admin_id' => $request->user()->id, 'action' => 'agency_created', 'entity_type' => 'agency', 'entity_id' => $agency->id, 'details' => ['name' => $agency->name]]);
return response()->json($this->format($agency), 201);
```

**`update($id)`** — validates `name` (sometimes), updates, logs `agency_updated`.

**`destroy($id)`** — deletes agency (cascades to routes, ratings, trips), logs `agency_deleted`.

**`addRoute($id)`** — validates `from_station_id`, `to_station_id` (both `required|exists:admin_stations,id`). Creates `AgencyRoute`. Prevents duplicate. Logs `agency_route_added`.

**`removeRoute($agencyId, $routeId)`** — deletes `AgencyRoute`. Logs `agency_route_removed`.

### `backend/app/Http/Controllers/Admin/TripController.php`

All methods behind `permission:manage-agencies`.

**`index()`** — returns trips with agency and station info, optionally filtered by `?agency_id=` and `?active=`:
```php
$trips = Trip::with(['agency', 'fromStation', 'toStation'])
    ->when($request->agency_id, fn($q) => $q->where('agency_id', $request->agency_id))
    ->when($request->filled('active'), fn($q) => $q->where('active', $request->boolean('active')))
    ->orderBy('departure_time')
    ->get();
```

Return format per trip:
```php
[
    'id', 'agency_id', 'agency_name' => $t->agency->name,
    'from' => ['id', 'city', 'district'],
    'to'   => ['id', 'city', 'district'],
    'departure_time', 'estimated_arrival_time',
    'price', 'total_seats', 'active',
]
```

**`store()`** — validates:
```php
'agency_id'              => 'required|exists:agencies,id',
'from_station_id'        => 'required|exists:admin_stations,id|different:to_station_id',
'to_station_id'          => 'required|exists:admin_stations,id',
'departure_time'         => 'required|date_format:H:i',
'estimated_arrival_time' => 'required|date_format:H:i',
'price'                  => 'required|integer|min:100',
'total_seats'            => 'required|integer|min:1|max:200',
'active'                 => 'boolean',
```
Creates trip. Logs `trip_created`.

**`update($id)`** — all fields `sometimes`, same validation. Logs `trip_updated`.

**`destroy($id)`** — deletes trip. Returns 409 if trip has pending/confirmed bookings. Logs `trip_deleted`.

### `backend/app/Http/Controllers/TripSearchController.php`

Public controller (no auth required).

**`index()`** — GET `/trips`:
```php
$request->validate([
    'from_station_id' => 'required|exists:admin_stations,id',
    'to_station_id'   => 'required|exists:admin_stations,id',
]);

$trips = Trip::with(['agency.ratings', 'fromStation', 'toStation'])
    ->where('from_station_id', $request->from_station_id)
    ->where('to_station_id', $request->to_station_id)
    ->where('active', true)
    ->orderBy('departure_time')
    ->get();

return response()->json($trips->map(fn($t) => [
    'id' => $t->id,
    'agency_id' => $t->agency_id,
    'agency_name' => $t->agency->name,
    'agency_rating' => $t->agency->average_rating,
    'agency_ratings_count' => $t->agency->ratings->count(),
    'from' => ['id' => $t->fromStation->id, 'city' => $t->fromStation->city],
    'to'   => ['id' => $t->toStation->id,   'city' => $t->toStation->city],
    'departure_time' => $t->departure_time,
    'estimated_arrival_time' => $t->estimated_arrival_time,
    'price' => $t->price,
    'total_seats' => $t->total_seats,
]));
```

### `backend/app/Http/Controllers/AgencyRatingController.php`

Protected (auth:sanctum). User can rate an agency they've booked with.

**`store($agencyId)`** — validates `stars` (required|integer|min:1|max:5), `comment` (nullable|string|max:500). Upserts `AgencyRating` (one per user per agency). Returns updated average rating.

### Update `backend/app/Http/Controllers/BookingController.php`

**`store()`** — change type validation to: `'required|in:bus,private,rental,trip'`

In the title/sub generation block, add `trip` case:
```php
'trip' => Trip::with(['agency', 'fromStation', 'toStation'])->find($itemId),
```

Title for trip:
```php
'trip' => "{$item->agency->name} · {$item->fromStation->city} → {$item->toStation->city}",
```

Sub for trip:
```php
'trip' => "Departs {$item->departure_time} · Est. arrival {$item->estimated_arrival_time}",
```

Also when creating a trip booking, set `trip_id`:
```php
if ($type === 'trip') {
    $bookingData['trip_id'] = $itemId;
}
```

### Update `backend/app/Http/Controllers/Admin/AdminBookingController.php`

**`index()`** — Fix station scoping. Replace broken `bookable` morph approach with:
```php
if ($user->isAdmin() && !$user->isSuperAdmin()) {
    $station = $user->adminStation; // AdminStation for this admin
    if ($station) {
        $query->where(function($q) use ($station) {
            // For trip bookings: filter by from_station_id of the trip
            $q->where(function($sq) use ($station) {
                $sq->where('type', 'trip')
                   ->whereHas('trip', fn($tq) => $tq->where('from_station_id', $station->id));
            })
            // For legacy bus bookings: filter by title containing station city
            ->orWhere(function($sq) use ($station) {
                $sq->where('type', 'bus')
                   ->where('title', 'like', "%{$station->city}%");
            });
        });
    } else {
        return response()->json([]);
    }
}
```

**`index()` response map** — enrich with full details for superadmin view:
```php
$bookings->map(fn($b) => [
    'id'                => $b->id,
    'type'              => $b->type,
    'title'             => $b->title,
    'sub'               => $b->sub,
    'price'             => $b->price,
    'service_fee'       => $b->service_fee,
    'total'             => $b->price + $b->service_fee,
    'status'            => $b->status,
    'payment_method'    => $b->payment_method,
    'travel_date'       => $b->travel_date,
    'ticket_photo_url'  => $b->ticket_photo_url,
    'user_name'         => $b->user?->name,
    'user_email'        => $b->user?->email,
    'user_phone'        => $b->user?->phone,
    'confirmed_by_name' => $b->confirmedBy?->name,
    'confirmed_at'      => $b->confirmed_at,
    'created_at'        => $b->created_at,
    // Trip-specific
    'trip_departure'    => $b->trip?->departure_time,
    'trip_arrival'      => $b->trip?->estimated_arrival_time,
    'agency_name'       => $b->trip?->agency?->name,
]);
```

**`update()`** — when status changes to `confirmed`, set `confirmed_by` and `confirmed_at`:
```php
if (isset($data['status']) && $data['status'] === 'confirmed') {
    $data['confirmed_by'] = $user->id;
    $data['confirmed_at'] = now();
    ActivityLog::create([
        'admin_id'    => $user->id,
        'action'      => 'booking_confirmed',
        'entity_type' => 'booking',
        'entity_id'   => $booking->id,
        'details'     => ['title' => $booking->title, 'user' => $booking->user?->name],
    ]);
}
```

---

## STEP 5 — API Routes (`backend/routes/api.php`)

Add these routes:

```php
use App\Http\Controllers\TripSearchController;
use App\Http\Controllers\AgencyRatingController;
use App\Http\Controllers\Admin\AgencyController;
use App\Http\Controllers\Admin\TripController;

// ── Public ──
Route::get('/trips', [TripSearchController::class, 'index']);

// ── Protected (auth:sanctum) ──
Route::middleware('auth:sanctum')->group(function () {
    // User rates an agency
    Route::post('/agencies/{agency}/rate', [AgencyRatingController::class, 'store']);

    // Admin — agencies & trips
    Route::middleware('permission:manage-agencies')->prefix('admin')->group(function () {
        Route::apiResource('agencies', AgencyController::class);
        Route::post('agencies/{agency}/routes', [AgencyController::class, 'addRoute']);
        Route::delete('agencies/{agency}/routes/{route}', [AgencyController::class, 'removeRoute']);
        Route::apiResource('trips', TripController::class);
    });
});
```

---

## STEP 6 — Service Fee Calculation (frontend)

In `mobile/lib/serviceFee.ts` (or inline in the booking sheet), compute trip service fee as:
```ts
export function tripServiceFee(price: number): number {
  return Math.max(500, Math.min(3000, Math.round(price * 0.05)));
}
```
This is 5% of the price, floored at 500 RWF, capped at 3000 RWF.

---

## STEP 7 — Frontend Admin Screens

### 7a. `mobile/app/(admin)/agencies/index.tsx`

Full CRUD screen. Register as hidden tab in `_layout.tsx`.

**UI layout:**
- Header: "Agencies" title + "＋" FAB
- List: each agency card shows name, average rating (★ 4.2), route count badge, edit/delete buttons
- Modal (pageSheet): name input, routes section (list of existing routes with delete, plus "Add route" which shows from/to station pickers using the same `StationPicker` or an admin-only dropdown loaded from `GET /stations`)

**Data loading:**
- `GET /admin/agencies` on mount and on refresh
- Route stations loaded from `GET /stations` (public endpoint)

**Key flows:**
1. Create agency: POST `/admin/agencies` with `{ name }`
2. Add route: POST `/admin/agencies/{id}/routes` with `{ from_station_id, to_station_id }`
3. Remove route: DELETE `/admin/agencies/{id}/routes/{routeId}`
4. Edit agency: PATCH `/admin/agencies/{id}` with `{ name }`
5. Delete agency: Alert confirm → DELETE `/admin/agencies/{id}`

**Activity log toast:** Show a success toast (use `Alert.alert` or a lightweight toast library) after each create/edit/delete.

### 7b. `mobile/app/(admin)/trips/index.tsx`

Full CRUD screen. Register as hidden tab.

**UI layout:**
- Header: "Trips" title + "＋" FAB
- Filter bar: agency picker chip, active/inactive toggle
- List: each trip card shows:
  - Agency name + rating stars
  - Route: `{from city}` → `{to city}`
  - Departure: **08:00** | Est. arrival: ~11:30
  - Price: **5,000 RWF** | Seats: 30
  - Active badge (green/grey)
  - Edit/Delete buttons

**Modal (pageSheet):**
- Agency picker (dropdown from GET /admin/agencies)
- From station picker (dropdown from GET /stations, exclude selected "to")
- To station picker (dropdown from GET /stations, exclude selected "from")
- Departure time picker (time input HH:MM, use TextInput with `keyboardType="numeric"` or a time picker)
- Estimated arrival time picker (same)
- Price input (integer, RWF)
- Total seats input (integer)
- Active toggle switch
- Button: "Add Trip" / "Update Trip"

**Key flows:**
1. Create: POST `/admin/trips`
2. Update: PATCH `/admin/trips/{id}`
3. Delete: Alert confirm → DELETE `/admin/trips/{id}`

### 7c. Register routes in `mobile/app/(admin)/_layout.tsx`

Add these hidden screens (so routing works without showing in tab bar):
```tsx
<Tabs.Screen name="agencies/index" options={{ href: null }} />
<Tabs.Screen name="trips/index" options={{ href: null }} />
```

### 7d. Add tiles in `mobile/app/(admin)/dashboard.tsx`

In the tiles array, add (visible to both admin and superadmin who have `manage-agencies` permission):
```ts
{ label: "Agencies", icon: "business-outline", route: "/(admin)/agencies" }
{ label: "Trips", icon: "bus-outline", route: "/(admin)/trips" }
```

Use `user?.permissions?.includes("manage-agencies")` to conditionally show.

---

## STEP 8 — Frontend User-facing Trip Search

### 8a. Home screen `mobile/app/(tabs)/index.tsx`

**Add a new mode tab: "Trips" (🎫)**

Current mode tabs: Bus | Private | Rental → Add: **Trips** as the first/primary tab.

```ts
type Mode = "trips" | "bus" | "private" | "rental";
```

Add state:
```ts
const [trips, setTrips] = useState<TripResult[]>([]);
```

Type definition:
```ts
type TripResult = {
  id: number;
  agency_id: number;
  agency_name: string;
  agency_rating: number;
  agency_ratings_count: number;
  from: { id: number; city: string };
  to: { id: number; city: string };
  departure_time: string; // "08:00"
  estimated_arrival_time: string; // "11:30"
  price: number;
  total_seats: number;
};
```

**Data fetching:** The home screen already has a `useEffect` that fetches on `[from, to, date]` change. Extend it:
```ts
// In the Promise.all, add trip search when from and to are selected
...(from && to ? [
  api.get('/trips', { params: { from_station_id: fromStationId, to_station_id: toStationId } })
] : [Promise.resolve({ data: [] })])
```

**IMPORTANT**: The `StationPicker` currently stores the station's `city` string as `from`/`to` state. For the trip search API, we need station IDs. Change `from`/`to` state to store the full station object:
```ts
const [from, setFrom] = useState<{ id: number; city: string } | null>(null);
const [to, setTo]     = useState<{ id: number; city: string } | null>(null);
```

Update `StationPicker` to call `onChange(station)` with the full object instead of just `station.city`. Update `StationPicker`'s `Props.onChange` type to `(v: { id: number; city: string }) => void`.

The picker trigger text uses `value?.city ?? placeholder`.

For buses/private-seats, keep passing `from?.city` and `to?.city` as before.

**Trip hour filter:**

Below the date chips, when mode is "trips", show an hour range filter:
- Chips: "All times" | "Morning (5–12)" | "Afternoon (12–18)" | "Evening (18–24)"
- Filter trips client-side by `departure_time` hour

**Trip results list:**

When mode is "trips" and `from` + `to` are selected:
```tsx
// Show count + hint
<Text>{trips.length} trips · {from.city} → {to.city}</Text>

// If no from/to selected, show prompt
<EmptyState icon="🎫" msg="Select departure and arrival stations to see trips" />

// Trip cards (see TripCard component below)
{filteredTrips.map(t => <TripCard key={t.id} trip={t} onPress={() => setSheet(t)} />)}
```

**Swap button:** swaps both the full station objects (not just city strings).

### 8b. New component `mobile/components/TripCard.tsx`

```tsx
type Props = {
  trip: TripResult;
  onPress: () => void;
};

export function TripCard({ trip, onPress }: Props) {
  const fee = tripServiceFee(trip.price);
  return (
    <TouchableOpacity onPress={onPress} style={cardStyle}>
      {/* Agency row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontWeight: "900", fontSize: 15, color: C.dark }}>
          {trip.agency_name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="star" size={12} color={C.yellow} />
          <Text style={{ color: C.mid, fontSize: 12 }}>
            {trip.agency_rating > 0 ? trip.agency_rating.toFixed(1) : "New"}
            {trip.agency_ratings_count > 0 ? ` (${trip.agency_ratings_count})` : ""}
          </Text>
        </View>
      </View>

      {/* Route */}
      <Text style={{ color: C.mid, fontSize: 13, marginTop: 4 }}>
        {trip.from.city} → {trip.to.city}
      </Text>

      {/* Times and Price row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
        <View>
          <Text style={{ color: C.dark, fontWeight: "800", fontSize: 20 }}>
            {trip.departure_time}
          </Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            Est. {trip.estimated_arrival_time} *
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: C.blue, fontWeight: "900", fontSize: 16 }}>
            {trip.price.toLocaleString()} RWF
          </Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            +{fee.toLocaleString()} fee
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
```

### 8c. Trip Booking Sheet `mobile/components/TripBookingSheet.tsx`

Shown when user taps a trip card. A bottom modal sheet (`Modal animationType="slide" transparent`).

**Sheet layout (from top to bottom):**
1. Handle bar
2. Agency name + star rating (interactive: user can tap stars to rate after booking)
3. Route: `{from}` ——→ `{to}` with arrow
4. Departure: `{departure_time}` in large bold
5. Estimated arrival: `~{estimated_arrival_time}` with note: *"Arrival time is an estimate and may vary"*
6. Divider
7. Price breakdown:
   - Trip price: `{price} RWF`
   - Service fee: `{fee} RWF`
   - **Total: `{price + fee} RWF`** (bold, larger)
8. Payment method selector: MTN MoMo | Airtel Money | Card (chips, one selectable)
9. Date selector: same date chips as home screen (Today / Tomorrow / etc.)
10. **"Book Now"** button (blue, full width) — disabled until payment method selected
11. Cancel/close button

**Booking logic on "Book Now":**
```ts
const payload = {
  type: "trip",
  reference_id: trip.id,
  price: trip.price,
  service_fee: tripServiceFee(trip.price),
  payment_method: selectedMethod,
  travel_date: selectedDate,
};
const res = await api.post("/bookings", payload);
// On success: close sheet, show success toast/alert
Alert.alert("Booking Confirmed!", "Your trip has been booked. Check your trips tab.");
```

**No booking sheet shown if user is not logged in** — check `getApiToken()` first, redirect to `/(auth)/login` if no token.

---

## STEP 9 — Admin Bookings Screen Update

`mobile/app/(admin)/bookings/index.tsx` (or wherever it exists — check `/(admin)/bookings`).

If this screen doesn't exist yet, create it at `mobile/app/(admin)/bookings/index.tsx`.

Register as hidden tab in `_layout.tsx`: `<Tabs.Screen name="bookings/index" options={{ href: null }} />`

The screen fetches from `GET /admin/bookings` (with `?status=pending` filter for admins, all statuses for superadmin).

**For regular admins:** Show only `pending` and `confirmed` trip bookings for their station (backend already filters).

**For superadmin:** Show all bookings with full detail columns.

**Booking list card shows:**
- Booker name + email + phone
- Trip: agency name, from → to, departure time
- Amount: price + service fee = total
- Status badge (color-coded): pending=orange, confirmed=green, completed=teal, cancelled=red
- Date booked

**Admin actions (non-superadmin):**
- "Confirm" button on pending bookings → PATCH `/admin/bookings/{id}` with `{ status: "confirmed" }`
- "Mark Complete" button on confirmed bookings → PATCH `/admin/bookings/{id}` with `{ status: "completed" }`

**Superadmin view extras:**
- Filter by status (chips: All | Pending | Confirmed | Completed | Cancelled)
- "Confirmed by" shown on each booking card
- Revenue summary at top: total service fees collected = system gain

---

## STEP 10 — Activity Logs Screen Update

`mobile/app/(admin)/logs/index.tsx` (or wherever it exists).

The existing logs screen fetches from `GET /admin/logs`. Ensure the following new action types are displayed with human-readable labels:

| action | Display label |
|--------|--------------|
| `agency_created` | "Created agency" |
| `agency_updated` | "Updated agency" |
| `agency_deleted` | "Deleted agency" |
| `agency_route_added` | "Added route to agency" |
| `agency_route_removed` | "Removed route from agency" |
| `trip_created` | "Created trip" |
| `trip_updated` | "Updated trip" |
| `trip_deleted` | "Deleted trip" |
| `booking_confirmed` | "Confirmed booking" |

---

## STEP 11 — Translations

Add the following keys to **all 4 locale files** (`en.json`, `rw.json`, `fr.json`, `sw.json`). Provide accurate translations for `rw` (Kinyarwanda), `fr` (French), `sw` (Swahili). For `en.json` use the English values below:

```json
{
  "agencies": {
    "title": "Agencies",
    "addNew": "Add Agency",
    "editAgency": "Edit Agency",
    "name": "Agency Name",
    "namePlaceholder": "e.g. Kigali Express",
    "routes": "Routes",
    "addRoute": "Add Route",
    "noRoutes": "No routes added yet",
    "noAgencies": "No agencies yet. Add your first agency.",
    "ratingAvg": "avg. rating",
    "deleteConfirm": "Delete this agency and all its trips?",
    "created": "Agency created successfully",
    "updated": "Agency updated successfully",
    "deleted": "Agency deleted",
    "routeAdded": "Route added",
    "routeRemoved": "Route removed"
  },
  "trips": {
    "title": "Trips",
    "addNew": "Add Trip",
    "editTrip": "Edit Trip",
    "agency": "Agency",
    "from": "From",
    "to": "To",
    "departure": "Departure Time",
    "estimatedArrival": "Est. Arrival Time",
    "price": "Price (RWF)",
    "totalSeats": "Total Seats",
    "active": "Active",
    "noTrips": "No trips found. Add a trip to get started.",
    "deleteConfirm": "Delete this trip? This cannot be undone.",
    "created": "Trip created successfully",
    "updated": "Trip updated successfully",
    "deleted": "Trip deleted",
    "arrivalDisclaimer": "Arrival time is an estimate and may vary"
  },
  "home": {
    "modeTrips": "Trips",
    "selectStationsPrompt": "Select departure and arrival stations to see available trips",
    "filterAllTimes": "All times",
    "filterMorning": "Morning",
    "filterAfternoon": "Afternoon",
    "filterEvening": "Evening",
    "noTripsRoute": "No trips available for this route"
  },
  "booking": {
    "tripBooking": "Book Trip",
    "priceSummary": "Price Summary",
    "tripPrice": "Trip Price",
    "serviceFee": "Service Fee",
    "totalAmount": "Total",
    "selectPayment": "Select Payment Method",
    "bookNow": "Book Now",
    "bookingSuccess": "Booking Confirmed!",
    "bookingSuccessMsg": "Your trip has been booked. Check your trips tab.",
    "loginRequired": "Please log in to book a trip",
    "arrivalNote": "* Arrival time is an estimate and may vary due to traffic"
  },
  "adminBookings": {
    "title": "Bookings",
    "pending": "Pending",
    "confirmed": "Confirmed",
    "completed": "Completed",
    "cancelled": "Cancelled",
    "confirm": "Confirm",
    "markComplete": "Mark Complete",
    "booker": "Booker",
    "confirmedBy": "Confirmed by",
    "revenueHeader": "Total Service Fees",
    "noBookings": "No bookings for your station"
  },
  "rating": {
    "rateAgency": "Rate this Agency",
    "yourRating": "Your Rating",
    "comment": "Comment (optional)",
    "submit": "Submit Rating",
    "success": "Thank you for your rating!"
  }
}
```

---

## STEP 12 — Toast / Feedback Pattern

Throughout all new screens, use this pattern for success/error feedback (consistent with existing codebase which uses `Alert.alert`):

```ts
// Success
Alert.alert("✓ Success", t('agencies.created'));

// Error
Alert.alert("Error", e?.response?.data?.message ?? "Something went wrong.");
```

For non-blocking feedback (preferred for list mutations), consider a lightweight approach: briefly set a `successMsg` state string displayed in a green banner above the list, auto-clearing after 2 seconds via `setTimeout`.

---

## STEP 13 — Final Checklist

Before marking complete, verify:

- [ ] All 5 migrations run without error (`php artisan migrate`)
- [ ] `manage-agencies` permission seeded and assigned to admin + superadmin
- [ ] `GET /trips?from_station_id=1&to_station_id=2` returns trip list (no auth needed)
- [ ] `POST /admin/agencies` creates agency and logs action (requires manage-agencies permission)
- [ ] `POST /admin/trips` creates trip with valid from/to/departure/price (requires manage-agencies)
- [ ] `POST /bookings` with `type: "trip"` creates booking with `trip_id` populated
- [ ] Admin can `PATCH /admin/bookings/{id}` to confirm, which sets `confirmed_by` + `confirmed_at`
- [ ] Station-scoped admin only sees bookings where the trip departs from their station
- [ ] Home screen mode "Trips" shows results when from + to station are both selected
- [ ] `StationPicker` passes full object `{ id, city }` to onChange
- [ ] `TripBookingSheet` shows service fee breakdown before booking
- [ ] All 4 locale files have all new translation keys
- [ ] All CRUD operations log to `ActivityLog`
- [ ] Superadmin bookings screen shows: booker, confirmed_by, all statuses, revenue total

---

## Key File Paths Reference

```
backend/
  app/Models/Agency.php
  app/Models/AgencyRoute.php
  app/Models/AgencyRating.php
  app/Models/Trip.php
  app/Models/Booking.php                         (update)
  app/Http/Controllers/Admin/AgencyController.php
  app/Http/Controllers/Admin/TripController.php
  app/Http/Controllers/Admin/AdminBookingController.php  (update)
  app/Http/Controllers/TripSearchController.php
  app/Http/Controllers/AgencyRatingController.php
  app/Http/Controllers/BookingController.php     (update type enum)
  database/migrations/[timestamps]_create_agencies_table.php
  database/migrations/[timestamps]_create_agency_routes_table.php
  database/migrations/[timestamps]_create_agency_ratings_table.php
  database/migrations/[timestamps]_create_trips_table.php
  database/migrations/[timestamps]_add_trip_fields_to_bookings.php
  database/seeders/RolesAndPermissionsSeeder.php (update)
  routes/api.php                                 (update)

mobile/
  app/(admin)/agencies/index.tsx
  app/(admin)/trips/index.tsx
  app/(admin)/_layout.tsx                        (update: register screens + dashboard tiles)
  app/(admin)/dashboard.tsx                      (update: add tiles)
  app/(tabs)/index.tsx                           (update: trips mode + StationPicker object)
  components/TripCard.tsx
  components/TripBookingSheet.tsx
  components/StationPicker.tsx                   (update: onChange passes full object)
  lib/serviceFee.ts                              (add tripServiceFee function)
  locales/en.json                                (update)
  locales/rw.json                                (update)
  locales/fr.json                                (update)
  locales/sw.json                                (update)
```
