<?php

namespace App\Modules\Rentals\Application;

use App\Models\ActivityLog;
use App\Models\CarRental;
use App\Models\User;
use App\Modules\Notifications\Contracts\PushSender;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Admins check a rental car's photos and papers before customers see it (story S24.8). */
class RentalVerification
{
    public function __construct(private PushSender $push)
    {
    }

    public function queue(string $status)
    {
        return CarRental::with('owner')->where('verification_status', $status)->whereNotNull('user_id')
            ->orderBy('updated_at')->limit(200)->get();
    }

    public function review(User $admin, CarRental $car, string $decision, ?string $note): CarRental
    {
        if ($decision === 'approve' && !empty(RentalCarPresenter::missing($car))) {
            throw new HttpException(409, 'This listing is incomplete: ' . implode(', ', RentalCarPresenter::missing($car)) . '.');
        }
        $approved = $decision === 'approve';
        $car->update([
            'verification_status' => $approved ? CarRental::VERIFIED : CarRental::REJECTED,
            'verification_note'   => $note,
            'verified_at'         => $approved ? now() : null,
        ]);
        ActivityLog::create([
            'admin_id'    => $admin->id,
            'action'      => $approved ? 'rental_car.verified' : 'rental_car.rejected',
            'entity_type' => 'car_rental',
            'entity_id'   => $car->id,
            'details'     => ['note' => $note, 'plate' => $car->plate],
        ]);
        if ($car->owner) {
            $this->push->send($car->owner,
                $approved ? 'Your car is live' : 'Your car listing needs changes',
                $approved ? "Customers can now find and rent your {$car->name}." : "{$car->name}: " . ($note ?: 'please check your listing.'),
                ['screen' => 'owner_car', 'id' => $car->id]);
        }

        return $car->fresh();
    }

    /** Admin view of a car: owner contact, documents present, what is missing */
    public static function present(CarRental $car): array
    {
        return array_merge(RentalCarPresenter::toFrontend($car), [
            'owner' => $car->owner ? ['id' => $car->owner->id, 'name' => $car->owner->name, 'phone' => $car->owner->phone] : null,
        ]);
    }
}
