<?php

namespace App\Modules\Support\Application;

use App\Models\DriverHire;
use App\Models\RentalBooking;
use App\Models\Ride;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\User;
use App\Modules\Notifications\Contracts\PushSender;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Support tickets (S16.3). A ticket may point to the user's own ride, hire or
 * rental; safety tickets are urgent (1 h first-response target) and alert
 * support staff. Status: open (waiting for Jali) → answered (waiting for the
 * customer) → resolved; a customer reply reopens it.
 */
class SupportDesk
{
    public function __construct(private PushSender $push)
    {
    }

    public function open(User $user, array $data): SupportTicket
    {
        $subject = null;
        if (!empty($data['subject_type'])) {
            $subject = self::subject($data['subject_type'], (int) $data['subject_id']);
            if (!$subject || !self::involves($subject, $user)) {
                throw ValidationException::withMessages(['subject_id' => 'Choose one of your own trips.']);
            }
        }
        $priority = SupportTicket::PRIORITY[$data['category']] ?? 'normal';

        $ticket = DB::transaction(function () use ($user, $data, $priority) {
            $ticket = SupportTicket::create([
                'user_id' => $user->id, 'subject_type' => $data['subject_type'] ?? null, 'subject_id' => $data['subject_id'] ?? null,
                'category' => $data['category'], 'priority' => $priority, 'status' => SupportTicket::OPEN,
                'first_response_due_at' => now()->addMinutes(SupportTicket::SLA_MINUTES[$priority]), 'last_message_at' => now(),
            ]);
            $ticket->messages()->create(['user_id' => $user->id, 'is_staff' => false, 'body' => $data['message']]);

            return $ticket;
        });

        if ($priority === 'urgent') {
            foreach (self::staff() as $agent) {
                $this->push->send($agent, 'Urgent safety ticket', "#{$ticket->id} from {$user->name}", ['screen' => 'admin_support_ticket', 'id' => $ticket->id]);
            }
        }

        return $ticket;
    }

    public function reply(SupportTicket $ticket, User $author, string $body, bool $asStaff): SupportMessage
    {
        if ($ticket->status === SupportTicket::RESOLVED && !$asStaff) {
            throw new HttpException(409, 'This ticket is resolved. Open a new one if you still need help.');
        }
        $message = DB::transaction(function () use ($ticket, $author, $body, $asStaff) {
            $message = $ticket->messages()->create(['user_id' => $author->id, 'is_staff' => $asStaff, 'body' => $body]);
            $ticket->forceFill([
                'status' => $asStaff ? SupportTicket::ANSWERED : SupportTicket::OPEN,
                'last_message_at' => now(),
                'first_responded_at' => $asStaff ? ($ticket->first_responded_at ?? now()) : $ticket->first_responded_at,
                'assigned_to' => $asStaff ? ($ticket->assigned_to ?? $author->id) : $ticket->assigned_to,
                'resolved_at' => null,
            ])->save();

            return $message;
        });
        if ($asStaff) {
            $this->push->send($ticket->user, 'Jali support replied', mb_strimwidth($body, 0, 120, '…'), ['screen' => 'support_ticket', 'id' => $ticket->id]);
        }

        return $message;
    }

    public function assign(SupportTicket $ticket, ?User $agent): SupportTicket
    {
        if ($agent && !$agent->hasPermission('manage-support')) {
            throw ValidationException::withMessages(['admin_id' => 'This person is not on the support team.']);
        }
        $ticket->forceFill(['assigned_to' => $agent?->id])->save();

        return $ticket;
    }

    public function setStatus(SupportTicket $ticket, string $status, User $by, bool $asStaff): SupportTicket
    {
        $ticket->forceFill(['status' => $status, 'resolved_at' => $status === SupportTicket::RESOLVED ? now() : null])->save();
        if ($asStaff && $status === SupportTicket::RESOLVED) {
            $this->push->send($ticket->user, 'Your support ticket is resolved', "Ticket #{$ticket->id}. Reply if you still need help.",
                ['screen' => 'support_ticket', 'id' => $ticket->id]);
        }

        return $ticket;
    }

    // ── Presenters ───────────────────────────────────────────────────────

    public static function present(SupportTicket $t, bool $forStaff, bool $withMessages = false): array
    {
        $out = [
            'id'          => $t->id,
            'category'    => $t->category,
            'priority'    => $t->priority,
            'status'      => $t->status,
            'subject'     => $t->subject_type ? ['type' => $t->subject_type, 'id' => (int) $t->subject_id, 'label' => self::subjectLabel($t->subject_type, (int) $t->subject_id)] : null,
            'preview'     => mb_strimwidth((string) $t->messages()->latest('id')->value('body'), 0, 100, '…'),
            'created_at'  => $t->created_at?->toIso8601String(),
            'last_message_at' => $t->last_message_at?->toIso8601String(),
            'resolved_at' => $t->resolved_at?->toIso8601String(),
        ];
        if ($forStaff) {
            $overdue = !$t->first_responded_at && $t->status !== SupportTicket::RESOLVED && $t->first_response_due_at->isPast();
            $out += [
                'user'     => ['id' => $t->user_id, 'name' => $t->user?->name, 'phone' => $t->user?->phone],
                'assignee' => $t->assignee ? ['id' => $t->assignee->id, 'name' => $t->assignee->name] : null,
                'sla'      => ['first_response_due_at' => $t->first_response_due_at->toIso8601String(),
                    'first_responded_at' => $t->first_responded_at?->toIso8601String(), 'overdue' => $overdue],
            ];
        }
        if ($withMessages) {
            $out['messages'] = $t->messages()->with('author:id,name')->get()->map(fn (SupportMessage $m) => [
                'id' => $m->id, 'is_staff' => $m->is_staff, 'body' => $m->body, 'created_at' => $m->created_at?->toIso8601String(),
                // Customers see "Jali support", never the agent's name
                'author' => $m->is_staff ? ($forStaff ? ($m->author?->name ?? 'Jali support') : 'Jali support') : ($m->author?->name ?? ''),
            ])->all();
        }

        return $out;
    }

    // ── Subjects ─────────────────────────────────────────────────────────

    private static function subject(string $type, int $id): ?object
    {
        return match ($type) {
            'ride'   => Ride::find($id),
            'hire'   => DriverHire::find($id),
            'rental' => RentalBooking::find($id),
            default  => null,
        };
    }

    private static function involves(object $s, User $user): bool
    {
        return match (true) {
            $s instanceof Ride          => in_array($user->id, [$s->rider_id, $s->driver_id]),
            $s instanceof DriverHire    => in_array($user->id, [$s->customer_id, $s->driver_id]),
            $s instanceof RentalBooking => in_array($user->id, [$s->customer_id, $s->owner_id]),
            default => false,
        };
    }

    private static function subjectLabel(string $type, int $id): string
    {
        $s = self::subject($type, $id);
        $when = match (true) {
            $s instanceof Ride          => $s->requested_at,
            $s instanceof DriverHire    => $s->start_at,
            $s instanceof RentalBooking => $s->start_at,
            default => null,
        };

        return ucfirst($type) . " #$id" . ($when ? ' · ' . $when->copy()->setTimezone('Africa/Kigali')->format('j M') : '');
    }

    /** @return iterable<User> */
    private static function staff(): iterable
    {
        return User::whereHas('role.permissions', fn ($q) => $q->where('name', 'manage-support'))->get();
    }
}
