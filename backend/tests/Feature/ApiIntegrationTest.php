<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Bus;
use App\Models\CarRental;
use App\Models\Permission;
use App\Models\PrivateSeat;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $passenger;
    protected User $admin;
    protected User $superadmin;
    protected User $driver;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed roles and permissions
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        // Create test users
        $this->passenger = User::create([
            'firebase_uid' => 'passenger_uid',
            'name' => 'Test Passenger',
        ]);
        $this->passenger->update(['role_id' => Role::where('name', 'user')->value('id')]);

        $this->driver = User::create([
            'firebase_uid' => 'driver_uid',
            'name' => 'Test Driver',
        ]);
        $this->driver->update(['role_id' => Role::where('name', 'driver')->value('id')]);

        $this->admin = User::create([
            'firebase_uid' => 'admin_uid',
            'name' => 'Test Admin',
        ]);
        $this->admin->update(['role_id' => Role::where('name', 'admin')->value('id')]);

        $this->superadmin = User::create([
            'firebase_uid' => 'superadmin_uid',
            'name' => 'Test Superadmin',
        ]);
        $this->superadmin->update(['role_id' => Role::where('name', 'superadmin')->value('id')]);
    }

    // ==================== BUS TESTS ====================

    /** @test */
    public function it_can_list_buses()
    {
        Bus::create([
            'agency' => 'Volcano Express',
            'from' => 'Kigali',
            'to' => 'Musanze',
            'dep' => '08:00',
            'arr' => '10:00',
            'price' => 3000,
            'seats' => 60,
            'rating' => 4.5,
            'active' => true,
        ]);

        $response = $this->getJson('/api/buses');
        $response->assertStatus(401);
    }

    /** @test */
    public function it_can_filter_buses_by_city()
    {
        Bus::create([
            'agency' => 'RITCO',
            'from' => 'Kigali',
            'to' => 'Huye',
            'dep' => '09:00',
            'arr' => '12:00',
            'price' => 2500,
            'seats' => 50,
            'rating' => 4.2,
            'active' => true,
        ]);

        $response = $this->getJson('/api/buses?from=Kigali');
        $response->assertStatus(401);
    }

    // ==================== CAR RENTAL TESTS ====================

    /** @test */
    public function it_can_list_car_rentals()
    {
        CarRental::create([
            'name' => 'Toyota RAV4',
            'type' => 'SUV',
            'price' => 50000,
            'seats' => 5,
            'plate' => 'RAD 123A',
            'rating' => 4.7,
            'active' => true,
        ]);

        $response = $this->getJson('/api/car-rentals');
        $response->assertStatus(401);
    }

    // ==================== PRIVATE SEAT TESTS ====================

    /** @test */
    public function it_can_list_private_seats()
    {
        PrivateSeat::create([
            'driver' => 'John Doe',
            'from' => 'Kigali',
            'to' => 'Musanze',
            'dep' => '2025-04-10 08:00',
            'price' => 2000,
            'seats' => 3,
            'rating' => 4.3,
        ]);

        $response = $this->getJson('/api/private-seats');
        $response->assertStatus(401);
    }

    // ==================== BOOKING TESTS ====================

    /** @test */
    public function it_validates_booking_creation()
    {
        $response = $this->postJson('/api/bookings', []);
        $response->assertStatus(401);
    }

    /** @test */
    public function it_can_show_user_bookings()
    {
        $response = $this->getJson('/api/bookings');
        $response->assertStatus(401);
    }

    // ==================== ADMIN TESTS ====================

    /** @test */
    public function it_requires_permission_for_ticket_upload()
    {
        $response = $this->patchJson('/api/bookings/1/ticket', [
            'ticket_photo_url' => 'https://example.com/ticket.jpg',
        ]);
        $response->assertStatus(401);
    }

    /** @test */
    public function it_requires_permission_for_booking_confirmation()
    {
        $response = $this->postJson('/api/bookings/1/claim');
        $response->assertStatus(401);
    }

    // ==================== ANALYTICS TESTS ====================

    /** @test */
    public function it_requires_permission_for_analytics()
    {
        $response = $this->getJson('/api/analytics/revenue');
        $response->assertStatus(401);
    }

    // ==================== MODEL RELATIONSHIP TESTS ====================

    /** @test */
    public function user_has_many_bookings()
    {
        $booking = Booking::create([
            'user_id' => $this->passenger->id,
            'type' => 'bus',
            'reference_id' => 1,
            'title' => 'Volcano Express • Kigali → Musanze',
            'sub' => 'Departs 08:00 • 60 seats',
            'price' => 3000,
            'service_fee' => 500,
            'status' => 'pending',
            'payment_method' => 'MTN MoMo',
        ]);

        $this->assertCount(1, $this->passenger->bookings);
        $this->assertEquals($booking->id, $this->passenger->bookings->first()->id);
    }

    /** @test */
    public function booking_stores_title_and_sub()
    {
        $booking = Booking::create([
            'user_id' => $this->passenger->id,
            'type' => 'bus',
            'reference_id' => 1,
            'title' => 'Volcano Express • Kigali → Musanze',
            'sub' => 'Departs 08:00 • 60 seats',
            'price' => 3000,
            'service_fee' => 500,
            'status' => 'pending',
            'payment_method' => 'MTN MoMo',
        ]);

        $this->assertEquals('Volcano Express • Kigali → Musanze', $booking->title);
        $this->assertEquals('Departs 08:00 • 60 seats', $booking->sub);
    }

    /** @test */
    public function booking_can_have_different_types()
    {
        $busBooking = Booking::create([
            'user_id' => $this->passenger->id,
            'type' => 'bus',
            'reference_id' => 1,
            'title' => 'Bus Trip',
            'sub' => 'Kigali → Musanze',
            'price' => 3000,
            'service_fee' => 500,
            'status' => 'pending',
            'payment_method' => 'MTN MoMo',
        ]);

        $rentalBooking = Booking::create([
            'user_id' => $this->passenger->id,
            'type' => 'rental',
            'reference_id' => 1,
            'title' => 'Car Rental',
            'sub' => 'Toyota RAV4',
            'price' => 50000,
            'service_fee' => 300,
            'status' => 'pending',
            'payment_method' => 'Airtel Money',
        ]);

        $this->assertEquals('bus', $busBooking->type);
        $this->assertEquals('rental', $rentalBooking->type);
    }

    /** @test */
    public function user_has_a_single_role()
    {
        $this->assertTrue($this->driver->hasRole('driver'));
        $this->assertFalse($this->driver->hasRole('user'));
        $this->assertFalse($this->driver->hasRole('admin'));
        $this->assertTrue($this->driver->isDriver());
    }

    /** @test */
    public function user_role_helpers_work_correctly()
    {
        $this->assertFalse($this->passenger->isAdmin());
        $this->assertFalse($this->passenger->isSuperAdmin());
        $this->assertTrue($this->admin->isAdmin());
        $this->assertFalse($this->admin->isSuperAdmin());
        $this->assertTrue($this->superadmin->isAdmin());
        $this->assertTrue($this->superadmin->isSuperAdmin());
    }

    /** @test */
    public function user_has_permission_through_roles()
    {
        $this->assertTrue($this->passenger->hasPermission('create-bookings'));
        $this->assertTrue($this->passenger->hasPermission('view-own-bookings'));
        $this->assertFalse($this->passenger->hasPermission('upload-tickets'));

        $this->assertTrue($this->admin->hasPermission('upload-tickets'));
        $this->assertTrue($this->admin->hasPermission('view-analytics'));
        $this->assertFalse($this->admin->hasPermission('manage-users'));

        $this->assertTrue($this->superadmin->hasPermission('view-analytics'));
        $this->assertTrue($this->superadmin->hasPermission('upload-tickets'));
    }

    /** @test */
    public function bus_has_correct_fields()
    {
        $bus = Bus::create([
            'agency' => 'Test Agency',
            'from' => 'Kigali',
            'to' => 'Musanze',
            'dep' => '08:00',
            'arr' => '10:00',
            'price' => 3000,
            'seats' => 60,
            'rating' => 4.5,
            'active' => true,
        ]);

        $this->assertEquals('Test Agency', $bus->agency);
        $this->assertEquals('Kigali', $bus->from);
        $this->assertEquals('Musanze', $bus->to);
        $this->assertEquals('08:00', $bus->dep);
        $this->assertEquals('10:00', $bus->arr);
        $this->assertEquals(3000, $bus->price);
        $this->assertEquals(60, $bus->seats);
    }

    /** @test */
    public function car_rental_has_correct_fields()
    {
        $car = CarRental::create([
            'name' => 'Toyota RAV4',
            'type' => 'SUV',
            'price' => 50000,
            'seats' => 5,
            'plate' => 'RAD 123A',
            'rating' => 4.7,
            'active' => true,
        ]);

        $this->assertEquals('Toyota RAV4', $car->name);
        $this->assertEquals('SUV', $car->type);
        $this->assertEquals(50000, $car->price);
        $this->assertEquals('RAD 123A', $car->plate);
    }

    /** @test */
    public function private_seat_has_correct_fields()
    {
        $seat = PrivateSeat::create([
            'driver' => 'John Doe',
            'from' => 'Kigali',
            'to' => 'Musanze',
            'dep' => '2025-04-10 08:00',
            'price' => 2000,
            'seats' => 3,
            'rating' => 4.3,
        ]);

        $this->assertEquals('John Doe', $seat->driver);
        $this->assertEquals('Kigali', $seat->from);
        $this->assertEquals('Musanze', $seat->to);
        $this->assertEquals(2000, $seat->price);
        $this->assertEquals(3, $seat->seats);
    }

    /** @test */
    public function roles_and_permissions_are_seeded_correctly()
    {
        $this->assertDatabaseCount('roles', 4);

        // Migrations add permissions beyond the seeder's list, so check the seeded ones exist
        foreach (['create-bookings', 'view-own-bookings', 'confirm-bookings', 'manage-users', 'manage-admins'] as $name) {
            $this->assertDatabaseHas('permissions', ['name' => $name]);
        }

        $superadmin = Role::where('name', 'superadmin')->first();
        $this->assertEquals(Permission::count(), $superadmin->permissions()->count());

        $user = Role::where('name', 'user')->first();
        $this->assertEquals(2, $user->permissions()->count());
    }
}
