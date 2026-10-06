<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use App\Modules\Support\Application\SupportDesk;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Customer / provider side of support tickets (S16.3). Only the ticket owner sees a ticket. */
class SupportController extends Controller
{
    public function __construct(private readonly SupportDesk $desk)
    {
    }

    /** GET /support/tickets */
    public function index(Request $request)
    {
        $tickets = SupportTicket::where('user_id', $request->user()->id)->orderByDesc('last_message_at')->limit(50)->get();

        return response()->json(['data' => $tickets->map(fn ($t) => SupportDesk::present($t, false))->all()]);
    }

    /** POST /support/tickets */
    public function store(Request $request)
    {
        $data = $request->validate([
            'category'     => ['required', Rule::in(SupportTicket::CATEGORIES)],
            'subject_type' => ['nullable', 'required_with:subject_id', Rule::in(SupportTicket::SUBJECTS)],
            'subject_id'   => 'nullable|required_with:subject_type|integer',
            'message'      => 'required|string|min:5|max:2000',
        ]);
        $ticket = $this->desk->open($request->user(), $data);

        return response()->json(SupportDesk::present($ticket->fresh(), false, true), 201);
    }

    /** GET /support/tickets/{id} */
    public function show(Request $request, int $id)
    {
        return response()->json(SupportDesk::present($this->mine($request, $id), false, true));
    }

    /** POST /support/tickets/{id}/messages */
    public function reply(Request $request, int $id)
    {
        $ticket = $this->mine($request, $id);
        $data = $request->validate(['body' => 'required|string|min:1|max:2000']);
        $this->desk->reply($ticket, $request->user(), $data['body'], false);

        return response()->json(SupportDesk::present($ticket->fresh(), false, true));
    }

    /** POST /support/tickets/{id}/resolve — the customer says it's solved */
    public function resolve(Request $request, int $id)
    {
        $ticket = $this->desk->setStatus($this->mine($request, $id), SupportTicket::RESOLVED, $request->user(), false);

        return response()->json(SupportDesk::present($ticket, false, true));
    }

    private function mine(Request $request, int $id): SupportTicket
    {
        return SupportTicket::where('user_id', $request->user()->id)->findOrFail($id);   // 404, never someone else's
    }
}
