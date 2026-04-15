# Jali Backend - Laravel API

REST API built with Laravel 11 for the Jali transportation booking platform.

## Stack

- **Framework**: Laravel 11
- **Database**: SQLite (local) / PostgreSQL (production)
- **Authentication**: Firebase Admin SDK (token verification)
- **Push Notifications**: Firebase FCM
- **File Storage**: Firebase Storage URLs

## Project Structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── AuthController.php          # Login/register with Firebase
│   │   │   ├── BookingController.php       # Booking CRUD + admin confirm
│   │   │   ├── BusController.php           # Bus listings
│   │   │   ├── CarRentalController.php     # Car rental listings
│   │   │   ├── PrivateSeatController.php   # Private seat listings
│   │   │   ├── DriverController.php        # Driver toggle + earnings
│   │   │   └── TicketController.php        # Admin ticket upload
│   │   └── Middleware/
│   │       ├── FirebaseAuth.php            # Firebase token verification
│   │       └── CheckRole.php               # Role-based access control
│   └── Models/
│       ├── User.php                        # User model with relationships
│       ├── Booking.php                     # Booking model
│       ├── Bus.php                         # Bus model
│       ├── CarRental.php                   # Car rental model
│       ├── PrivateSeat.php                 # Private seat model
│       └── Driver.php                      # Driver model
├── database/
│   └── migrations/                         # All database migrations
├── routes/
│   └── api.php                             # API route definitions
├── tests/
│   └── Feature/
│       └── ApiIntegrationTest.php          # Comprehensive API tests
└── .env                                    # Environment configuration
```

## Setup Instructions

### Prerequisites

- PHP 8.2+
- Composer
- SQLite or PostgreSQL

### Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies (already done)
composer install

# Copy environment file
cp .env.example .env

# Generate application key (already done)
php artisan key:generate

# Run migrations
php artisan migrate

# Run tests
php artisan test
```

### Firebase Configuration

1. Download your Firebase service account key JSON file
2. Place it at: `storage/app/firebase-credentials.json`
3. The `.env` file already has: `FIREBASE_CREDENTIALS=storage/app/firebase-credentials.json`

**Never commit the Firebase credentials file to git!**

## API Endpoints

### Authentication (Public)

```
POST /api/auth/login
Headers: Authorization: Bearer <Firebase ID Token>
Body (optional): { "fcm_token": "..." }
```

### Listings (Protected - requires Firebase token)

```
GET /api/buses?from=Kigali&to=Musanze
GET /api/car-rentals?type=SUV&sort=price&order=asc
GET /api/private-seats?from=Kigali&to=Musanze&date=2025-04-10
```

### Bookings (Protected)

```
GET /api/bookings?status=pending&type=bus
POST /api/bookings
{
  "type": "bus",
  "reference_id": 1,
  "travel_date": "2025-04-10",
  "price": 3000,
  "service_fee": 300,
  "payment_method": "mtn_momo"
}
GET /api/bookings/{id}
```

### Driver (Protected - drivers only)

```
POST /api/driver/toggle
{
  "zone": "Kigali",
  "plate": "RAD 123A",
  "vehicle_model": "Toyota Corolla"
}
GET /api/driver/earnings
```

### Admin Only

```
PATCH /api/bookings/{id}/ticket
{
  "ticket_photo_url": "https://firebasestorage.googleapis.com/..."
}

PATCH /api/bookings/{id}/confirm
```

## Database Schema

### users
- `id` (PK)
- `firebase_uid` (unique) - links to Firebase Auth
- `name`
- `phone` (nullable)
- `email` (nullable)
- `fcm_token` (nullable) - for push notifications
- `role` - 'passenger', 'driver', or 'admin'

### buses
- `id` (PK)
- `agency` - "Volcano Express", "RITCO", etc.
- `from_city`
- `to_city`
- `departure` (time)
- `arrival` (time)
- `price` (RWF)
- `total_seats`
- `rating`
- `active` (boolean)

### car_rentals
- `id` (PK)
- `name` - "Toyota RAV4"
- `type` - "SUV", "Sedan", "Minivan"
- `price_day` (RWF per day)
- `seats`
- `plate`
- `rating`
- `active` (boolean)

### private_seats
- `id` (PK)
- `driver_id` (FK → users.id)
- `from_city`
- `to_city`
- `departure` (datetime)
- `price` (RWF)
- `available_seats`
- `rating`

### bookings
- `id` (PK)
- `user_id` (FK → users.id)
- `type` - 'bus', 'rental', or 'private'
- `reference_id` - bus.id / car_rental.id / private_seat.id
- `travel_date`
- `status` - 'pending', 'confirmed', or 'completed'
- `price` (RWF)
- `service_fee` (RWF)
- `ticket_photo_url` (nullable) - Firebase Storage URL
- `payment_method` - 'mtn_momo', 'airtel_money', or 'card'
- `paid_at` (nullable)

### drivers
- `id` (PK)
- `user_id` (FK → users.id, unique)
- `plate`
- `vehicle_model`
- `online` (boolean)
- `zone` (nullable)
- `earnings_total` (RWF lifetime)

## Model Relationships

```
User
├── hasMany Bookings
├── hasOne Driver
└── hasMany PrivateSeats (as driver)

Booking
├── belongsTo User
└── belongsTo Bus/CarRental/PrivateSeat (polymorphic via bookable())

PrivateSeat
└── belongsTo User (as driver)

Driver
└── belongsTo User
```

## Security Features

1. **Firebase Authentication**: Every protected endpoint verifies Firebase ID tokens
2. **Role-Based Access Control**: Admin-only endpoints protected by `role:admin` middleware
3. **User Isolation**: Users can only view their own bookings
4. **Input Validation**: All endpoints validate request data
5. **SQL Injection Protection**: Laravel's Eloquent ORM prevents SQL injection
6. **XSS Protection**: Laravel's built-in CSRF and XSS protection

## Testing

```bash
# Run all tests
php artisan test

# Run specific test file
php artisan test tests/Feature/ApiIntegrationTest.php

# Run with coverage (requires Xdebug)
php artisan test --coverage
```

All tests pass successfully:
- ✅ 15 API integration tests
- ✅ 2 Auth tests
- ✅ Model relationship tests
- ✅ Role helper tests

## Production Deployment (PostgreSQL)

To switch to PostgreSQL for production:

1. Update `.env`:
```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=jali
DB_USERNAME=jali_user
DB_PASSWORD=your_password
```

2. Run migrations:
```bash
php artisan migrate
```

See `backend_laravel.md` for full Hetzner VPS deployment instructions.

## Environment Variables

Key environment variables in `.env`:

```env
# Database (SQLite for local)
DB_CONNECTION=sqlite

# Firebase
FIREBASE_CREDENTIALS=storage/app/firebase-credentials.json

# App
APP_NAME=Jali
APP_ENV=local
APP_DEBUG=true
```

## What's NOT Committed

The following files are in `.gitignore`:
- `.env`
- `storage/app/firebase-credentials.json`

These must be configured separately on the production server.

## Next Steps

1. Start the Laravel development server:
```bash
php artisan serve
```

2. Test endpoints with your mobile app

3. Configure Firebase credentials

4. Deploy to Hetzner VPS when ready (see deployment section in backend_laravel.md)

## API Testing Examples

```bash
# List buses (requires auth)
curl -H "Authorization: Bearer <firebase_token>" \
  https://jali.stoka.rw/backend/public/api/buses?from=Kigali&to=Musanze

# Create booking
curl -X POST \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bus",
    "reference_id": 1,
    "travel_date": "2025-04-10",
    "price": 3000,
    "service_fee": 300,
    "payment_method": "mtn_momo"
  }' \
  https://jali.stoka.rw/backend/public/api/bookings

# Driver toggle
curl -X POST \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{"zone": "Kigali"}' \
  https://jali.stoka.rw/backend/public/api/driver/toggle
```

## Support

For questions or issues, refer to the main project documentation in `backend_laravel.md` or `context.md`.
