<?php

namespace App\Modules\Safety\Application;

use App\Models\User;

/** The rider's emergency contact, texted on SOS (S8.2). Input is validated by the transport. */
class EmergencyContacts
{
    /** @return array{name: ?string, phone: ?string} */
    public function of(User $user): array
    {
        return ['name' => $user->emergency_contact_name, 'phone' => $user->emergency_contact_phone];
    }

    /** @param array{name: string, phone: string} $contact */
    public function save(User $user, array $contact): void
    {
        $user->update(['emergency_contact_name' => $contact['name'], 'emergency_contact_phone' => $contact['phone']]);
    }
}
