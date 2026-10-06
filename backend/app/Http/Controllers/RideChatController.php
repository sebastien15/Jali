<?php

namespace App\Http\Controllers;

use App\Models\RideMessage;
use App\Modules\NearbyRides\Application\RideChat;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Rider ↔ driver chat between accept and completion (story S9.5).
 * Transport adapter for NearbyRides (runbook M03-Rides): validation + HTTP shape only.
 */
class RideChatController extends Controller
{
    public function __construct(private readonly RideChat $chat)
    {
    }

    /** GET /rides/{id}/messages?after_id= */
    public function index(Request $request, int $id)
    {
        $user = $request->user();
        $ride = $this->chat->ride($user, $id);

        return response()->json($this->chat->thread($ride, $user, (int) $request->query('after_id', 0)));
    }

    /** POST /rides/{id}/messages {phrase} or {body} */
    public function store(Request $request, int $id)
    {
        $user = $request->user();
        $ride = $this->chat->ride($user, $id);
        if (!$this->chat->isOpen($ride)) {
            return response()->json(['message' => 'Chat is open between pickup acceptance and the end of the trip.'], 409);
        }
        $data = $request->validate([
            'phrase' => ['required_without:body', 'nullable', Rule::in(RideMessage::PHRASES)],
            'body'   => 'required_without:phrase|nullable|string|max:300',
        ]);

        return response()->json($this->chat->send($ride, $user, $data['phrase'] ?? null, $data['body'] ?? null), 201);
    }
}
