<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Providers\Application\DriverVerification;
use App\Modules\Providers\Application\ProviderRequestRejected;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Driver verification queue (story S1.4). Requires verify-drivers.
 * Transport adapter for Providers (M03-Remaining): permission check, validation + HTTP shape only.
 */
class AdminDriverController extends Controller
{
    private const STATUSES = ['pending', 'verified', 'rejected', 'suspended'];

    public function __construct(private readonly DriverVerification $verification)
    {
    }

    /** GET /admin/drivers?status=pending — oldest submission first */
    public function index(Request $request)
    {
        $this->authorizeReviewer($request);
        $status = $request->validate(['status' => ['sometimes', Rule::in(self::STATUSES)]])['status'] ?? 'pending';

        return response()->json($this->verification->queue($status));
    }

    /**
     * GET /admin/drivers/review — S8.4: drivers rated below the minimum after enough rated trips,
     * or cancelling more than the allowed share of their accepted rides recently.
     */
    public function review(Request $request)
    {
        $this->authorizeReviewer($request);

        return response()->json($this->verification->needingReview());
    }

    /** POST /admin/drivers/{userId}/warn {message} — S8.4: the driver is notified and it is logged */
    public function warn(Request $request, int $userId)
    {
        $admin = $this->authorizeReviewer($request);
        $message = $request->validate(['message' => 'required|string|min:5|max:500'])['message'];
        $this->verification->warn($admin, $userId, $message);

        return response()->json(['message' => 'Warning sent.', 'warned_at' => now()->toIso8601String()]);
    }

    /** GET /admin/drivers/{userId} */
    public function show(Request $request, int $userId)
    {
        $this->authorizeReviewer($request);

        return response()->json($this->verification->detail($this->verification->applicant($userId)));
    }

    /** POST /admin/drivers/{userId}/verify */
    public function verify(Request $request, int $userId)
    {
        $admin = $this->authorizeReviewer($request);
        $user = $this->verification->applicant($userId);

        return $this->respond(fn () => $this->verification->verify($admin, $user));
    }

    /** POST /admin/drivers/{userId}/reject  { reason, documents?: {type: reason} } */
    public function reject(Request $request, int $userId)
    {
        $admin = $this->authorizeReviewer($request);
        $validated = $request->validate([
            'reason'      => 'required|string|max:500',
            'documents'   => 'sometimes|array',
            'documents.*' => 'string|max:255',
        ]);
        $user = $this->verification->applicant($userId);

        return $this->respond(fn () => $this->verification->reject($admin, $user, $validated));
    }

    /** POST /admin/drivers/{userId}/suspend  { reason } */
    public function suspend(Request $request, int $userId)
    {
        $admin = $this->authorizeReviewer($request);
        $validated = $request->validate(['reason' => 'required|string|max:500']);
        $user = $this->verification->applicant($userId);

        return $this->respond(fn () => $this->verification->suspend($admin, $user, $validated['reason']));
    }

    private function authorizeReviewer(Request $request): User
    {
        $user = $request->user();
        abort_unless($user->hasPermission('verify-drivers'), 403);

        return $user;
    }

    private function respond(callable $decision)
    {
        try {
            return response()->json($decision());
        } catch (ProviderRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }
}
