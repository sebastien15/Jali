<?php
// End-to-end smoke test against a running API on a freshly seeded LOCAL DB (uses demo accounts).
// Usage: php artisan migrate:fresh --seed && php artisan serve --port=8091; php tests/e2e/smoke.php http://127.0.0.1:8091/api
$base = $argv[1] ?? 'http://127.0.0.1:8091/api';
$fail = 0;

function call(string $method, string $path, ?string $token = null, array $body = []): array {
    global $base;
    $ch = curl_init($base . $path);
    $headers = ['Accept: application/json', 'Content-Type: application/json'];
    if ($token) $headers[] = "Authorization: Bearer $token";
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body ? json_encode($body) : null,
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode($raw, true), $raw];
}
function check(string $name, bool $ok, string $extra = ''): void {
    global $fail;
    echo ($ok ? "PASS " : "FAIL ") . $name . ($ok ? '' : "  $extra") . "\n";
    if (!$ok) $fail++;
}
function login(string $email): string {
    [$c, $j] = call('POST', '/auth/login', null, ['email' => $email, 'password' => 'Jali@2026']);
    return $j['token'] ?? '';
}

// ── Passenger ───────────────────────────────────────────────
$user = login('user@jali.rw');
check('passenger login', $user !== '');
[$c, $j] = call('GET', '/me', $user);
check('GET /me', $c === 200 && $j['roles'] === 'user', "$c");
[$c, $j] = call('GET', '/trips', $user);
check('trip search returns priced routes', $c === 200 && $j['total'] > 0 && $j['data'][0]['price'] > 0, "$c");
$route = $j['data'][0];
$dep = $route['departures'][0]['id'];
[$c, $j] = call('GET', '/stations', $user);
check('station list hides admin emails', $c === 200 && !isset($j[0]['admin_email']), "$c");
[$c, $j] = call('POST', '/bookings', $user, ['type' => 'trip', 'reference_id' => $dep, 'payment_method' => 'MTN MoMo', 'travel_date' => 'Tomorrow', 'quantity' => 2, 'price' => 1]);
check('book 2 seats (server prices it)', $c === 201 && $j['price'] === $route['price'] * 2 + max(500, min(3000, (int) round($route['price'] * 0.05))), "$c " . json_encode($j));
$bookingId = $j['id'] ?? 0;
[$c, $j] = call('GET', '/bookings', $user);
check('my bookings include new one', $c === 200 && in_array($bookingId, array_column($j, 'id')), "$c");
[$c] = call('POST', "/agencies/{$route['agency_id']}/rate", $user, ['stars' => 5]);
check('rate agency after booking', $c === 200, "$c");
[$c] = call('GET', '/admin/bookings', $user);
check('passenger blocked from admin queue', $c === 403, "$c");
[$c] = call('POST', '/auth/otp/verify', null, ['phone' => '0788123456', 'otp' => '000000']);
check('wrong OTP rejected', $c === 401, "$c");
[$c] = call('POST', '/auth/login', null, ['email' => 'emmanuel@email.com', 'password' => 'anything']);
check('passwordless account login rejected', $c === 401, "$c");

// ── Superadmin assigns a station agent, agent processes booking ─────
$super = login('superadmin@jali.rw');
check('superadmin login', $super !== '');
[$c, $stations] = call('GET', '/admin/stations', $super);
$from = $route['from']['id'];
[$c, $agentMe] = call('GET', '/me', $agent = login('admin.kigali@jali.rw'));
check('agent login', $agent !== '' && $agentMe['roles'] === 'admin');
[$c] = call('PATCH', "/admin/stations/$from", $super, ['admin_id' => $agentMe['id']]);
check('assign agent to departure station', $c === 200, "$c");
[$c, $j] = call('GET', '/admin/bookings', $agent);
check('agent sees the new booking', $c === 200 && in_array($bookingId, array_column($j, 'id')), "$c");
[$c] = call('PATCH', "/admin/bookings/$bookingId", $agent, ['status' => 'delivered']);
check('cannot skip to delivered', $c === 422, "$c");
[$c] = call('PATCH', "/admin/bookings/$bookingId", $agent, ['status' => 'taken']);
check('agent claims booking', $c === 200, "$c");
[$c] = call('POST', "/bookings/$bookingId/claim", $super);
check('second claim rejected', $c === 422, "$c");
[$c] = call('PATCH', "/admin/bookings/$bookingId", $agent, ['ticket_photo_url' => 'https://example.com/t.jpg', 'status' => 'ticket_ready']);
check('agent attaches ticket', $c === 200, "$c");
[$c] = call('PATCH', "/admin/bookings/$bookingId", $agent, ['status' => 'delivered']);
check('agent delivers', $c === 200, "$c");
[$c, $j] = call('GET', '/analytics/earnings', $agent);
check('agent earnings > 0', $c === 200 && $j['data']['total_earnings'] > 0, "$c " . json_encode($j));
[$c, $j] = call('GET', '/admin/profile', $agent);
check('available balance shown', $c === 200 && $j['available_balance'] > 0, "$c");
[$c] = call('POST', '/admin/cashout/preference', $agent, ['cashout_method' => 'mobile', 'cashout_account_number' => '0788000000']);
[$c] = call('POST', '/admin/cashout/requests', $agent, ['amount' => 99999999]);
check('over-balance cashout rejected', $c === 422, "$c");
[$c, $j] = call('GET', "/bookings/$bookingId", $user);
check('passenger sees delivered + ticket', $c === 200 && $j['status'] === 'delivered' && $j['ticket_photo_url'], "$c");
[$c] = call('DELETE', "/admin/agencies/{$route['agency_id']}", $agent);
check('agent cannot delete agency', $c === 403, "$c");
[$c, $j] = call('GET', '/analytics/bookings', $super);
check('superadmin analytics', $c === 200 && $j['data']['by_type']['trip'] > 0, "$c");
[$c, $j] = call('GET', '/admin/logs', $super);
check('activity log has claim', $c === 200 && in_array('booking_claimed', array_column($j['data'], 'action')), "$c");

// ── Driver ──────────────────────────────────────────────────
$driver = login('joseph.driver@email.com');
if (!$driver) {
    // demo drivers have no password; promote a passenger via superadmin instead
    [$c, $users] = call('GET', '/admin/users', $super);
    $u = array_values(array_filter($users, fn ($x) => $x['email'] === 'user@jali.rw'))[0];
    [$c] = call('PATCH', "/admin/users/{$u['id']}", $super, ['role' => 'driver']);
    check('superadmin promotes user to driver', $c === 200, "$c");
    $driver = $user;
}
[$c, $j] = call('POST', '/driver/listings', $driver, ['from' => 'Kigali', 'to' => 'Huye', 'pickup_station' => 'Nyabugogo', 'dep' => '07:30', 'date' => 'Tomorrow', 'price' => 4000, 'seats' => 3]);
check('driver creates listing', $c === 201, "$c " . json_encode($j));
$listing = $j['id'] ?? 0;
[$c, $j] = call('GET', '/private-seats?date=Tomorrow&from=Kigali', $user);
check('listing searchable by date', $c === 200 && in_array($listing, array_column($j['data'], 'id')), "$c");
[$c] = call('PATCH', '/driver/profile', $driver, ['car_model' => 'Hiace', 'plate' => 'RAD 1']);
[$c, $j] = call('GET', '/driver/profile', $driver);
check('driver profile persisted', $c === 200 && ($j['profile']['plate'] ?? null) === 'RAD 1', "$c");

echo "\n" . ($fail ? "$fail FAILED" : "ALL PASSED") . "\n";
exit($fail ? 1 : 0);
