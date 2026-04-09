# Jali — Laravel Backend

## Overview

REST API built with Laravel 11 + PostgreSQL. Handles all business logic.
Firebase is used only for identity — every request from the mobile app carries a Firebase ID token, which Laravel verifies before doing anything.

Hosted on Hetzner VPS (~$6/mo).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Laravel 11 |
| Database | PostgreSQL |
| Auth | Firebase Admin SDK (token verification) |
| File refs | Firebase Storage URLs (no files stored in Laravel) |
| Push | Firebase FCM (via Admin SDK) |
| Server | Nginx + PHP-FPM on Hetzner VPS |

---

## Folder Structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── AuthController.php
│   │   │   ├── BookingController.php
│   │   │   ├── BusController.php
│   │   │   ├── CarRentalController.php
│   │   │   ├── PrivateSeatController.php
│   │   │   ├── TicketController.php
│   │   │   └── AnalyticsController.php
│   │   └── Middleware/
│   │       ├── FirebaseAuth.php
│   │       └── CheckPermission.php
│   └── Models/
│       ├── User.php
│       ├── Role.php
│       ├── Permission.php
│       ├── AdminStation.php
│       ├── Booking.php
│       ├── Bus.php
│       ├── CarRental.php
│       └── PrivateSeat.php
├── database/
│   └── migrations/
├── routes/
│   └── api.php
└── .env
```

---

## Database Schema

### users
```sql
id                  bigint PK
firebase_uid        varchar UNIQUE  -- links to Firebase Auth
name                varchar
phone               varchar
email               varchar nullable
fcm_token           varchar nullable  -- for push notifications
created_at          timestamp
updated_at          timestamp
```

### roles
```sql
id                  bigint PK
name                varchar UNIQUE    -- 'superadmin', 'admin', 'user', 'driver'
description         varchar nullable
created_at          timestamp
updated_at          timestamp
```

### permissions
```sql
id                  bigint PK
name                varchar UNIQUE    -- 'manage-users', 'upload-tickets', 'view-analytics', etc.
description         varchar nullable
created_at          timestamp
updated_at          timestamp
```

### user_roles (pivot — users can have multiple roles)
```sql
user_id             bigint FK → users.id
role_id             bigint FK → roles.id
PRIMARY KEY (user_id, role_id)
```

### role_permissions (pivot)
```sql
role_id             bigint FK → roles.id
permission_id       bigint FK → permissions.id
PRIMARY KEY (role_id, permission_id)
```

### admin_stations (one admin per bus station/city)
```sql
id                  bigint PK
user_id             bigint FK → users.id UNIQUE
city                varchar         -- the bus station they manage
created_at          timestamp
updated_at          timestamp
```

### buses
```sql
id          bigint PK
agency      varchar         -- "Volcano Express", "RITCO", etc.
from        varchar
to          varchar
dep         varchar         -- "HH:MM" format
arr         varchar         -- "HH:MM" format
price       integer         -- RWF
seats       integer
rating      decimal(2,1)
active      boolean default true
created_at  timestamp
updated_at  timestamp
```

### car_rentals
```sql
id          bigint PK
name        varchar         -- "Toyota RAV4"
type        varchar         -- "SUV", "Sedan", "Minivan"
price       integer         -- RWF per day
seats       integer
plate       varchar
rating      decimal(2,1)
active      boolean default true
created_at  timestamp
updated_at  timestamp
```

### private_seats
```sql
id          bigint PK
driver      varchar         -- driver name
from        varchar
to          varchar
dep         varchar         -- datetime string
price       integer         -- RWF, upfront no-refund
seats       integer
rating      decimal(2,1)
created_at  timestamp
updated_at  timestamp
```

### bookings
```sql
id                  bigint PK
user_id             bigint FK → users.id
type                varchar         -- 'bus', 'rental', 'private'
reference_id        bigint          -- bus.id / car_rental.id / private_seat.id
title               varchar         -- auto-generated: "Agency • From → To"
sub                 varchar         -- auto-generated: "Departs HH:MM • X seats"
price               integer         -- RWF (ticket/rental price)
service_fee         integer         -- RWF (300–500 based on GPS distance)
status              varchar         -- 'pending', 'confirmed', 'completed'
ticket_photo_url    varchar nullable  -- Firebase Storage URL, set by admin
payment_method      varchar         -- 'MTN MoMo', 'Airtel Money', 'Card'
paid_at             timestamp nullable
created_at          timestamp
updated_at          timestamp
```

---

## Roles & Permissions Matrix

| Role | Permissions | Description |
|------|-------------|-------------|
| **superadmin** | ALL permissions | Full system access, manage admins, view all analytics |
| **admin** | upload-tickets, confirm-bookings, view-station-analytics | One per bus station, manages tickets for their station only |
| **user** | create-bookings, view-own-bookings | Default role for passengers |
| **driver** | create-private-seats, view-own-earnings | Can also have 'user' role simultaneously |

**Note:** A user can have multiple roles (e.g., both 'user' and 'driver'). This is handled via the `user_roles` pivot table.

---

## Revenue & Analytics Breakdown

For each booking:
- **User pays:** `price + service_fee`
- **Service provider gets:** `price` (bus agency, car rental, or driver)
- **Jali business gets:** `service_fee`
- **Business split:** 50% to platform operations, 50% to admin station manager

Example: Booking with 3000 RWF ticket + 500 RWF service fee
- User pays: 3500 RWF
- Service provider gets: 3000 RWF
- Jali platform gets: 250 RWF
- Admin station gets: 250 RWF

---

## API Routes

```php
// routes/api.php

// Public — no auth needed
Route::post('/auth/login', [AuthController::class, 'login']);

// Protected — requires Firebase ID token
Route::middleware('firebase.auth')->group(function () {

    // Listings
    Route::get('/buses',         [BusController::class, 'index']);
    Route::get('/car-rentals',   [CarRentalController::class, 'index']);
    Route::get('/private-seats', [PrivateSeatController::class, 'index']);

    // Bookings
    Route::get('/bookings',      [BookingController::class, 'index']);   // user's trips
    Route::post('/bookings',     [BookingController::class, 'store']);   // create booking
    Route::get('/bookings/{id}', [BookingController::class, 'show']);

    // Admin — ticket management (requires upload-tickets permission)
    Route::middleware('permission:upload-tickets')->group(function () {
        Route::patch('/bookings/{id}/ticket', [TicketController::class, 'upload']);
        Route::patch('/bookings/{id}/confirm', [BookingController::class, 'confirm']);
    });

    // Analytics — superadmin only
    Route::middleware('permission:view-analytics')->group(function () {
        Route::get('/analytics/revenue',     [AnalyticsController::class, 'revenue']);
        Route::get('/analytics/bookings',    [AnalyticsController::class, 'bookings']);
        Route::get('/analytics/stations',    [AnalyticsController::class, 'stations']);
    });
});
```

---

## Firebase Auth Middleware

Every protected request must send the Firebase ID token:
```
Authorization: Bearer <Firebase ID Token>
```

```php
// app/Http/Middleware/FirebaseAuth.php

use Kreait\Firebase\Factory;
use Kreait\Firebase\Auth;

class FirebaseAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        if (!$token) return response()->json(['error' => 'Unauthorized'], 401);

        try {
            $factory = (new Factory)->withServiceAccount(config('firebase.credentials'));
            $auth = $factory->createAuth();
            $verified = $auth->verifyIdToken($token);
            $uid = $verified->claims()->get('sub');

            // Find or create user in PostgreSQL
            $user = User::firstOrCreate(
                ['firebase_uid' => $uid],
                ['name' => $verified->claims()->get('name') ?? 'User']
            );

            // Assign default 'user' role if new
            if ($user->wasRecentlyCreated) {
                $userRole = Role::where('name', 'user')->first();
                $user->roles()->attach($userRole);
            }

            $request->merge(['auth_user' => $user]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        return $next($request);
    }
}
```

## Permission Middleware

```php
// app/Http/Middleware/CheckPermission.php

class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission)
    {
        $user = $request->auth_user ?? null;

        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if (!$user->hasPermission($permission)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
```

**Package needed:**
```bash
composer require kreait/laravel-firebase
```

Config in `.env`:
```
FIREBASE_CREDENTIALS=storage/app/firebase-credentials.json
```

The `firebase-credentials.json` is a service account key from Firebase Console → Project Settings → Service accounts → Generate new private key. **Never commit this file.**

---

## Key Controller Logic

### AuthController — first login / register
```php
public function login(Request $request)
{
    // Verify token, create user if new
    // Return user profile + any pending bookings
}
```

### BookingController — create booking
```php
public function store(Request $request)
{
    $user = $request->auth_user;

    // Calculate service fee (300–500 RWF based on GPS distance)
    // passed from mobile as: $request->service_fee

    Booking::create([
        'user_id'        => $user->id,
        'type'           => $request->type,
        'reference_id'   => $request->reference_id,
        'travel_date'    => $request->travel_date,
        'price'          => $request->price,
        'service_fee'    => $request->service_fee,
        'payment_method' => $request->payment_method,
        'status'         => 'pending',
    ]);
}
```

### TicketController — admin uploads photo URL + notifies user
```php
public function upload(Request $request, $id)
{
    $booking = Booking::findOrFail($id);
    $booking->update([
        'ticket_photo_url' => $request->ticket_photo_url,  // Firebase Storage URL
        'status'           => 'confirmed',
    ]);

    // Send FCM push to user
    $this->sendPush($booking->user->fcm_token, [
        'title' => 'Your ticket is ready',
        'body'  => 'Tap to view your ticket for ' . $booking->title,
    ]);
}
```

---

## How the Mobile App Connects

```
Mobile (Expo)                     Laravel API
─────────────────────────────────────────────
1. Firebase signs user in    →
2. Get Firebase ID Token     →
3. POST /auth/login               → verify token → create/find user
   Authorization: Bearer <token>  ← return user profile

4. GET /buses?from=Kigali         → return bus list from PostgreSQL
   &to=Musanze&date=2025-04-10

5. POST /bookings                 → create booking (status: pending)
   { type, reference_id,          ← return booking ID
     travel_date, service_fee,
     payment_method }

6. (Admin uploads ticket photo to Firebase Storage)
7. (Admin calls PATCH /bookings/{id}/ticket with URL)
8.                                → FCM push sent to user
9. User opens My Trips            → GET /bookings → sees ticket photo URL
10. App loads photo from          → Firebase Storage CDN
    ticket_photo_url
```

---

## Setup Steps (when ready to build)

```bash
# 1. Create Laravel project
composer create-project laravel/laravel backend
cd backend

# 2. Install Firebase Admin SDK
composer require kreait/laravel-firebase

# 3. Configure .env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=jali
DB_USERNAME=jali_user
DB_PASSWORD=your_password

FIREBASE_CREDENTIALS=storage/app/firebase-credentials.json

# 4. Run migrations
php artisan migrate

# 5. Register middleware in bootstrap/app.php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'firebase.auth' => \App\Http\Middleware\FirebaseAuth::class,
        'permission'    => \App\Http\Middleware\CheckPermission::class,
    ]);
})

# 6. Seed default roles and permissions
php artisan db:seed --class=RolesAndPermissionsSeeder
```

---

## Default Roles & Permissions Seeder

```php
// database/seeders/RolesAndPermissionsSeeder.php

public function run(): void
{
    // Create permissions
    $permissions = [
        'create-bookings',
        'view-own-bookings',
        'upload-tickets',
        'confirm-bookings',
        'create-private-seats',
        'view-own-earnings',
        'view-analytics',
        'manage-users',
        'manage-admins',
        'view-station-analytics',
    ];

    foreach ($permissions as $perm) {
        Permission::create(['name' => $perm, 'description' => ucfirst(str_replace('-', ' ', $perm))]);
    }

    // Create roles
    $superadmin = Role::create(['name' => 'superadmin', 'description' => 'Full system access']);
    $admin = Role::create(['name' => 'admin', 'description' => 'Bus station manager']);
    $user = Role::create(['name' => 'user', 'description' => 'Passenger']);
    $driver = Role::create(['name' => 'driver', 'description' => 'Private driver']);

    // Assign permissions to roles
    $superadmin->permissions()->attach(Permission::all());

    $admin->permissions()->attach(
        Permission::whereIn('name', ['upload-tickets', 'confirm-bookings', 'view-station-analytics'])->get()
    );

    $user->permissions()->attach(
        Permission::whereIn('name', ['create-bookings', 'view-own-bookings'])->get()
    );

    $driver->permissions()->attach(
        Permission::whereIn('name', ['create-private-seats', 'view-own-earnings'])->get()
    );
}
```

---

## Deployment on Hetzner VPS

```bash
# Server setup (Ubuntu 22.04)
apt install nginx php8.3-fpm php8.3-pgsql composer postgresql

# PostgreSQL
createuser jali_user
createdb jali -O jali_user

# Clone repo
git clone https://github.com/sebastien15/Jali.git /var/www/jali/backend

# Nginx config — /etc/nginx/sites-available/jali-api
server {
    listen 80;
    server_name api.jali.rw;
    root /var/www/jali/backend/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    }
}

# SSL
apt install certbot python3-certbot-nginx
certbot --nginx -d api.jali.rw
```

---

## What NOT to commit

```gitignore
# backend/.gitignore
.env
storage/app/firebase-credentials.json
```

The Firebase service account key and `.env` stay only on the server.
