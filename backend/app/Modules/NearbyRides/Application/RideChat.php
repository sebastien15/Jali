<?php

namespace App\Modules\NearbyRides\Application;

use App\Models\Ride;
use App\Models\RideMessage;
use App\Models\User;
use App\Services\PushService;
use Illuminate\Validation\ValidationException;

/**
 * Rider ↔ driver chat between accept and completion (story S9.5).
 * Phone numbers and links are refused so contact stays in the app.
 */
class RideChat
{
    public function __construct(private PushService $push)
    {
    }

    /** The rider's or assigned driver's ride; 404 'Ride not found.' for anyone else */
    public function ride(User $user, int $id): Ride
    {
        $ride = Ride::findOrFail($id);
        abort_unless($ride->involves($user), 404, 'Ride not found.');

        return $ride;
    }

    public function isOpen(Ride $ride): bool
    {
        return in_array($ride->status, Ride::ONGOING, true);
    }

    /** GET /rides/{id}/messages?after_id= */
    public function thread(Ride $ride, User $viewer, int $afterId): array
    {
        return [
            'open' => $this->isOpen($ride),
            'phrases' => RideMessage::PHRASES,
            'messages' => RideMessage::where('ride_id', $ride->id)->where('id', '>', $afterId)->orderBy('id')->limit(200)->get()
                ->map(fn (RideMessage $m) => $this->present($m, $viewer->id))->values(),
        ];
    }

    /** POST /rides/{id}/messages — the ride must be open; input already validated */
    public function send(Ride $ride, User $sender, ?string $phrase, ?string $body): array
    {
        $body = $body !== null ? trim($body) : null;
        if ($body !== null && self::containsContactInfo($body)) {
            throw ValidationException::withMessages(['body' => 'Phone numbers and links can\'t be sent in chat. Use the call button instead.']);
        }

        $message = RideMessage::create(['ride_id' => $ride->id, 'sender_id' => $sender->id, 'phrase' => $phrase, 'body' => $body ?: null]);
        $other = $ride->rider_id === $sender->id ? $ride->driver : $ride->rider;
        if ($other) {
            $this->push->send($other, 'New message', $body ?: 'Your ' . ($ride->rider_id === $sender->id ? 'rider' : 'driver') . ' sent you a message',
                ['screen' => $ride->rider_id === $sender->id ? 'driver_ride' : 'ride', 'id' => $ride->id]);
        }

        return $this->present($message, $sender->id);
    }

    /** 7+ digits (phone numbers, even with spaces/dashes), URLs, www., emails */
    public static function containsContactInfo(string $text): bool
    {
        return (bool) preg_match('/(\d[\s\-\.]*){7,}/', $text)
            || (bool) preg_match('#(https?://|www\.|\b[a-z0-9-]+\.(com|rw|org|net|io|me|app|link|ly)\b|@[a-z0-9-]+\.)#i', $text);
    }

    private function present(RideMessage $m, int $viewerId): array
    {
        return ['id' => $m->id, 'mine' => $m->sender_id === $viewerId, 'phrase' => $m->phrase, 'body' => $m->body,
            'at' => $m->created_at?->toIso8601String()];
    }
}
