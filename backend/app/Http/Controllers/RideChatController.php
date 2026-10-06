<?php

namespace App\Http\Controllers;

use App\Models\Ride;
use App\Models\RideMessage;
use App\Services\PushService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Rider ↔ driver chat between accept and completion (story S9.5).
 * Phone numbers and links are refused so contact stays in the app.
 */
class RideChatController extends Controller
{
    /** GET /rides/{id}/messages?after_id= */
    public function index(Request $request, int $id)
    {
        $user = $request->user();
        $ride = $this->ride($user, $id);
        $after = (int) $request->query('after_id', 0);

        return response()->json([
            'open' => in_array($ride->status, Ride::ONGOING, true),
            'phrases' => RideMessage::PHRASES,
            'messages' => RideMessage::where('ride_id', $ride->id)->where('id', '>', $after)->orderBy('id')->limit(200)->get()
                ->map(fn (RideMessage $m) => $this->present($m, $user->id))->values(),
        ]);
    }

    /** POST /rides/{id}/messages {phrase} or {body} */
    public function store(Request $request, PushService $push, int $id)
    {
        $user = $request->user();
        $ride = $this->ride($user, $id);
        if (!in_array($ride->status, Ride::ONGOING, true)) {
            return response()->json(['message' => 'Chat is open between pickup acceptance and the end of the trip.'], 409);
        }
        $data = $request->validate([
            'phrase' => ['required_without:body', 'nullable', Rule::in(RideMessage::PHRASES)],
            'body'   => 'required_without:phrase|nullable|string|max:300',
        ]);
        $body = isset($data['body']) ? trim($data['body']) : null;
        if ($body !== null && self::containsContactInfo($body)) {
            throw ValidationException::withMessages(['body' => 'Phone numbers and links can\'t be sent in chat. Use the call button instead.']);
        }

        $message = RideMessage::create(['ride_id' => $ride->id, 'sender_id' => $user->id, 'phrase' => $data['phrase'] ?? null, 'body' => $body ?: null]);
        $other = $ride->rider_id === $user->id ? $ride->driver : $ride->rider;
        if ($other) {
            $push->send($other, 'New message', $body ?: 'Your ' . ($ride->rider_id === $user->id ? 'rider' : 'driver') . ' sent you a message',
                ['screen' => $ride->rider_id === $user->id ? 'driver_ride' : 'ride', 'id' => $ride->id]);
        }

        return response()->json($this->present($message, $user->id), 201);
    }

    /** 7+ digits (phone numbers, even with spaces/dashes), URLs, www., emails */
    public static function containsContactInfo(string $text): bool
    {
        return (bool) preg_match('/(\d[\s\-\.]*){7,}/', $text)
            || (bool) preg_match('#(https?://|www\.|\b[a-z0-9-]+\.(com|rw|org|net|io|me|app|link|ly)\b|@[a-z0-9-]+\.)#i', $text);
    }

    private function ride($user, int $id): Ride
    {
        $ride = Ride::findOrFail($id);
        abort_unless($ride->involves($user), 404, 'Ride not found.');

        return $ride;
    }

    private function present(RideMessage $m, int $viewerId): array
    {
        return ['id' => $m->id, 'mine' => $m->sender_id === $viewerId, 'phrase' => $m->phrase, 'body' => $m->body,
            'at' => $m->created_at?->toIso8601String()];
    }
}
