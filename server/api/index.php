<?php
/**
 * BillKul account server: what the app talks to.
 *
 *   index.php?r=ping            is the server there
 *   index.php?r=auth/start      {phone}                 does this number sign in with a password
 *   index.php?r=auth/password   {phone, password, device}  sign in with the password
 *   index.php?r=auth/request    {phone}                 ask for a sign-in code
 *   index.php?r=auth/verify     {phone, code, device}   exchange the code for a sign-in
 *   index.php?r=account/sync    {token, docsUsed, cashUsed, appVersion, platform}
 *   index.php?r=auth/logout     {token}
 *   index.php?r=account/password {token, password, current}  set or change the password
 *   index.php?r=account/delete  {token}                 delete the account for good
 *
 * Every answer is JSON: {"ok":true,...} or {"ok":false,"error":"<word>"}.
 * The route is a query value, not a path, so no rewrite rules are needed on the hosting.
 */
declare(strict_types=1);

require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
// The app signs in with a token it sends itself, never with cookies, so any page may call this.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');

function reply(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $error, int $status = 400, array $more = []): void
{
    reply(['ok' => false, 'error' => $error] + $more, $status);
}

$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$route = (string) ($_GET['r'] ?? '');

try {
    if (!config()) {
        fail('setup', 503);
    }
    if ($route === 'ping') {
        reply(['ok' => true, 'service' => 'billkul']);
    }
    if ($method !== 'POST') {
        fail('post_only', 405);
    }

    $raw = (string) file_get_contents('php://input', false, null, 0, 8192);
    $in = json_decode($raw, true);
    if (!is_array($in)) {
        fail('bad_request');
    }
    $text = static function (string $key, int $max = 80) use ($in): string {
        $value = $in[$key] ?? '';
        return is_scalar($value) ? substr(trim((string) $value), 0, $max) : '';
    };
    $count = static function (string $key) use ($in): int {
        $value = $in[$key] ?? 0;
        return is_numeric($value) ? max(0, min(1000000, (int) $value)) : 0;
    };

    $pdo = db();
    $now = time();

    if ($route === 'auth/start') {
        $phone = normalize_phone($text('phone', 40));
        if ($phone === null) {
            fail('bad_phone');
        }
        if (!allow('start-ip:' . client_ip(), REQUESTS_PER_HOUR, 3600)) {
            fail('too_many', 429);
        }
        $account = find_account($phone);
        reply(['ok' => true, 'hasPassword' => $account !== null && (string) ($account['password_hash'] ?? '') !== '']);
    }

    if ($route === 'auth/password') {
        $phone = normalize_phone($text('phone', 40));
        $password = (string) ($in['password'] ?? '');
        if ($phone === null) {
            fail('bad_phone');
        }
        if (!allow('pw-ip:' . client_ip(), VERIFIES_PER_HOUR, 3600)) {
            fail('too_many', 429);
        }
        if (recent('pw-fail:' . $phone, 3600) >= PASSWORD_FAILS) {
            fail('too_many', 429);
        }
        $account = find_account($phone);
        if (!$account || (string) ($account['password_hash'] ?? '') === '') {
            fail('no_password');
        }
        if (strlen($password) > 200 || !password_verify($password, (string) $account['password_hash'])) {
            remember('pw-fail:' . $phone);
            fail('bad_password', 400, ['triesLeft' => max(0, PASSWORD_FAILS - recent('pw-fail:' . $phone, 3600))]);
        }
        $token = issue_token($account, $text('device', 60), 'password');
        reply(['ok' => true, 'token' => $token, 'account' => account_view($account)]);
    }

    if ($route === 'account/password') {
        $account = account_by_token($text('token', 64));
        if (!$account) {
            fail('signed_out', 401);
        }
        $password = (string) ($in['password'] ?? '');
        if (strlen($password) < PASSWORD_MIN || strlen($password) > 72) {
            fail('weak_password');
        }
        $has = (string) ($account['password_hash'] ?? '') !== '';
        // Right after proving the number with a code (a new account, or a forgotten password),
        // the old password is not needed. Otherwise it is.
        $fresh = $account['token_via'] === 'code' && (int) $account['token_at'] > $now - FRESH_CODE_SIGN_IN;
        if ($has && !$fresh) {
            if (!allow('pwc-acc:' . $account['id'], PASSWORD_FAILS, 3600)) {
                fail('too_many', 429);
            }
            if (!password_verify((string) ($in['current'] ?? ''), (string) $account['password_hash'])) {
                fail('bad_password');
            }
        }
        $pdo->prepare('UPDATE accounts SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $account['id']]);
        // A new password signs out every other device, in case the old one was known to someone else.
        $pdo->prepare('DELETE FROM tokens WHERE account_id = ? AND hash <> ?')->execute([$account['id'], $account['token_hash']]);
        reply(['ok' => true, 'account' => account_view(find_account($account['phone']))]);
    }

    if ($route === 'auth/request') {
        $phone = normalize_phone($text('phone', 40));
        if ($phone === null) {
            fail('bad_phone');
        }
        if (!allow('req-ip:' . client_ip(), REQUESTS_PER_HOUR, 3600)) {
            fail('too_many', 429);
        }
        $q = $pdo->prepare('SELECT created_at FROM codes WHERE phone = ?');
        $q->execute([$phone]);
        $last = $q->fetchColumn();
        if ($last !== false && (int) $last > $now - RESEND_WAIT) {
            fail('wait', 429, ['wait' => (int) $last + RESEND_WAIT - $now]);
        }
        if (!allow('req-phone:' . $phone, CODES_PER_HOUR, 3600)) {
            fail('too_many', 429);
        }

        $q = $pdo->prepare('SELECT code FROM test_numbers WHERE phone = ?');
        $q->execute([$phone]);
        $fixed = $q->fetchColumn();
        if ($fixed !== false) {
            // A test number: its code is fixed and is never sent or listed.
            $code = (string) $fixed;
            $plain = null;
            $delivery = 'test';
        } else {
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $plain = $code;
            $delivery = 'manual';
        }
        $pdo->prepare('INSERT OR REPLACE INTO codes (phone, code_hash, code_plain, created_at, expires_at, attempts) VALUES (?, ?, ?, ?, ?, 0)')
            ->execute([$phone, code_hash($phone, $code), $plain, $now, $now + CODE_LIFE]);

        $notify = setting('notify_email');
        if ($plain !== null && $notify !== '') {
            // Tells the owner a code is waiting to be sent. Not every hosting delivers this mail.
            @mail($notify, 'BillKul code for ' . $phone, "Code $plain for $phone.\nOpen the admin page to send it on WhatsApp.\nIt works for 10 minutes.");
        }
        reply(['ok' => true, 'wait' => RESEND_WAIT, 'expiresIn' => CODE_LIFE, 'delivery' => $delivery]);
    }

    if ($route === 'auth/verify') {
        $phone = normalize_phone($text('phone', 40));
        $code = preg_replace('/\D+/', '', $text('code', 12));
        if ($phone === null) {
            fail('bad_phone');
        }
        if ($code === null || strlen($code) < 4 || strlen($code) > 8) {
            fail('bad_code');
        }
        if (!allow('ver-ip:' . client_ip(), VERIFIES_PER_HOUR, 3600)) {
            fail('too_many', 429);
        }
        $q = $pdo->prepare('SELECT * FROM codes WHERE phone = ?');
        $q->execute([$phone]);
        $row = $q->fetch();
        if (!$row || (int) $row['expires_at'] < $now) {
            fail('expired');
        }
        if ((int) $row['attempts'] >= CODE_TRIES) {
            $pdo->prepare('DELETE FROM codes WHERE phone = ?')->execute([$phone]);
            fail('expired');
        }
        $pdo->prepare('UPDATE codes SET attempts = attempts + 1 WHERE phone = ?')->execute([$phone]);
        if (!hash_equals((string) $row['code_hash'], code_hash($phone, $code))) {
            fail('bad_code', 400, ['triesLeft' => max(0, CODE_TRIES - (int) $row['attempts'] - 1)]);
        }
        $pdo->prepare('DELETE FROM codes WHERE phone = ?')->execute([$phone]);

        $account = find_account($phone);
        if (!$account) {
            // A number that had an account before starts from the allowance it had already used.
            $q = $pdo->prepare('SELECT docs_used, cash_used FROM used_allowance WHERE phone_hash = ?');
            $q->execute([phone_hash($phone)]);
            $before = $q->fetch() ?: ['docs_used' => 0, 'cash_used' => 0];
            $pdo->prepare('INSERT INTO accounts (phone, docs_used, cash_used, created_at, seen_at) VALUES (?, ?, ?, ?, ?)')
                ->execute([$phone, (int) $before['docs_used'], (int) $before['cash_used'], $now, $now]);
            $account = find_account($phone);
        }
        $token = issue_token($account, $text('device', 60), 'code');
        reply(['ok' => true, 'token' => $token, 'account' => account_view($account)]);
    }

    if ($route === 'account/sync') {
        $account = account_by_token($text('token', 64));
        if (!$account) {
            fail('signed_out', 401);
        }
        // Counts only ever go up: clearing the app or reinstalling does not give the free allowance back.
        $docs = max((int) $account['docs_used'], $count('docsUsed'));
        $cash = max((int) $account['cash_used'], $count('cashUsed'));
        $pdo->prepare('UPDATE accounts SET docs_used = ?, cash_used = ?, seen_at = ?, app_version = ?, platform = ? WHERE id = ?')
            ->execute([$docs, $cash, $now, $text('appVersion', 20), $text('platform', 20), $account['id']]);
        reply(['ok' => true, 'account' => account_view(find_account($account['phone']))]);
    }

    if ($route === 'auth/logout') {
        $token = $text('token', 64);
        if (preg_match('/^[a-f0-9]{64}$/', $token)) {
            $pdo->prepare('DELETE FROM tokens WHERE hash = ?')->execute([hash('sha256', $token)]);
        }
        reply(['ok' => true]);
    }

    if ($route === 'account/delete') {
        $account = account_by_token($text('token', 64));
        if (!$account) {
            fail('signed_out', 401);
        }
        $pdo->prepare('INSERT OR REPLACE INTO used_allowance (phone_hash, docs_used, cash_used, deleted_at) VALUES (?, ?, ?, ?)')
            ->execute([phone_hash($account['phone']), (int) $account['docs_used'], (int) $account['cash_used'], $now]);
        $pdo->prepare('DELETE FROM tokens WHERE account_id = ?')->execute([$account['id']]);
        $pdo->prepare('DELETE FROM codes WHERE phone = ?')->execute([$account['phone']]);
        $pdo->prepare('DELETE FROM accounts WHERE id = ?')->execute([$account['id']]);
        reply(['ok' => true]);
    }

    fail('not_found', 404);
} catch (Throwable $e) {
    error_log('BillKul API: ' . $e->getMessage());
    fail('server', 500);
}
