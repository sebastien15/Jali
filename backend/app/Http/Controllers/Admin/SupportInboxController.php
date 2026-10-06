<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\SupportCannedReply;
use App\Models\SupportTicket;
use App\Models\User;
use App\Modules\Support\Application\SupportDesk;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Support inbox for staff (S16.3): urgent first, then by first-response deadline. */
class SupportInboxController extends Controller
{
    public function __construct(private readonly SupportDesk $desk)
    {
    }

    /** GET /admin/support/tickets?status=open|answered|resolved&mine=1&priority= */
    public function index(Request $request)
    {
        $data = $request->validate([
            'status'   => ['sometimes', Rule::in(SupportTicket::STATUSES)],
            'priority' => ['sometimes', Rule::in(['urgent', 'high', 'normal'])],
            'mine'     => 'sometimes|boolean',
        ]);
        $tickets = SupportTicket::with(['user:id,name,phone', 'assignee:id,name'])
            ->where('status', $data['status'] ?? SupportTicket::OPEN)
            ->when($data['priority'] ?? null, fn ($q, $p) => $q->where('priority', $p))
            ->when($request->boolean('mine'), fn ($q) => $q->where('assigned_to', $request->user()->id))
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END")
            ->orderBy('first_response_due_at')
            ->limit(100)->get();
        $counts = SupportTicket::where('status', SupportTicket::OPEN)->selectRaw('priority, count(*) as n')->groupBy('priority')->pluck('n', 'priority');

        return response()->json([
            'data'   => $tickets->map(fn ($t) => SupportDesk::present($t, true))->all(),
            'counts' => ['open' => (int) $counts->sum(), 'urgent' => (int) ($counts['urgent'] ?? 0),
                'overdue' => SupportTicket::where('status', SupportTicket::OPEN)->whereNull('first_responded_at')->where('first_response_due_at', '<', now())->count()],
        ]);
    }

    /** GET /admin/support/tickets/{id} */
    public function show(int $id)
    {
        return response()->json(SupportDesk::present(SupportTicket::findOrFail($id), true, true));
    }

    /** POST /admin/support/tickets/{id}/messages */
    public function reply(Request $request, int $id)
    {
        $ticket = SupportTicket::findOrFail($id);
        $data = $request->validate(['body' => 'required|string|min:1|max:2000']);
        $this->desk->reply($ticket, $request->user(), $data['body'], true);

        return response()->json(SupportDesk::present($ticket->fresh(), true, true));
    }

    /** POST /admin/support/tickets/{id}/assign {admin_id|null} — omit admin_id to take it yourself */
    public function assign(Request $request, int $id)
    {
        $ticket = SupportTicket::findOrFail($id);
        $data = $request->validate(['admin_id' => 'sometimes|nullable|integer|exists:users,id']);
        $agent = array_key_exists('admin_id', $data) ? ($data['admin_id'] ? User::find($data['admin_id']) : null) : $request->user();
        $this->desk->assign($ticket, $agent);
        $this->log($request, 'support_ticket_assigned', $ticket, ['assigned_to' => $agent?->id]);

        return response()->json(SupportDesk::present($ticket->fresh(), true, true));
    }

    /** POST /admin/support/tickets/{id}/status {status} */
    public function status(Request $request, int $id)
    {
        $ticket = SupportTicket::findOrFail($id);
        $data = $request->validate(['status' => ['required', Rule::in(SupportTicket::STATUSES)]]);
        $this->desk->setStatus($ticket, $data['status'], $request->user(), true);
        $this->log($request, 'support_ticket_status', $ticket, ['status' => $data['status']]);

        return response()->json(SupportDesk::present($ticket->fresh(), true, true));
    }

    /** GET /admin/support/canned-replies */
    public function cannedIndex()
    {
        return response()->json(['data' => SupportCannedReply::orderBy('title')->get(['id', 'title', 'body'])]);
    }

    /** POST /admin/support/canned-replies */
    public function cannedStore(Request $request)
    {
        $data = $request->validate(['title' => 'required|string|max:80', 'body' => 'required|string|max:2000']);
        $reply = SupportCannedReply::create($data + ['created_by' => $request->user()->id]);

        return response()->json($reply->only(['id', 'title', 'body']), 201);
    }

    /** DELETE /admin/support/canned-replies/{id} */
    public function cannedDestroy(int $id)
    {
        SupportCannedReply::findOrFail($id)->delete();

        return response()->noContent();
    }

    private function log(Request $request, string $action, SupportTicket $ticket, array $details): void
    {
        ActivityLog::create(['admin_id' => $request->user()->id, 'action' => $action, 'entity_type' => 'support_ticket',
            'entity_id' => $ticket->id, 'details' => $details]);
    }
}
