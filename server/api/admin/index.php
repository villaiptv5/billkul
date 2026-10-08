<?php
/**
 * BillKul admin page, for the owner only.
 *
 * First visit: choose the admin password (this also creates the database).
 * After that: see sign-in codes waiting to be sent, switch Pro on or off for a number,
 * keep the list of test numbers, and change the free limits.
 */
declare(strict_types=1);

require __DIR__ . '/../lib.php';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('bkadmin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

function h($text): string
{
    return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
}

function csrf(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function field(): string
{
    return '<input type="hidden" name="csrf" value="' . h(csrf()) . '">';
}

function back(string $tab = '', string $note = ''): void
{
    if ($note !== '') {
        $_SESSION['note'] = $note;
    }
    header('Location: ./' . ($tab !== '' ? '?tab=' . rawurlencode($tab) : ''), true, 303);
    exit;
}

function ago(int $at): string
{
    $s = max(0, time() - $at);
    if ($s < 90) return 'just now';
    if ($s < 5400) return round($s / 60) . ' min ago';
    if ($s < 129600) return round($s / 3600) . ' h ago';
    return gmdate('j M Y', $at);
}

function page(string $title, string $body): void
{
    $css = 'body{margin:0;font:15px/1.5 system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#F4F7F5;color:#0B1F17}
.top{background:#0B1F17;color:#fff;padding:14px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.top b{font-size:18px}.top b span{color:#00D27A}.top a{color:#C9D8D0;text-decoration:none;padding:6px 10px;border-radius:8px}
.top a.on{background:#18301F;color:#fff}.top form{margin-left:auto}
main{max-width:1000px;margin:0 auto;padding:20px}
.card{background:#fff;border:1px solid #DCE5E0;border-radius:14px;padding:18px;margin-bottom:18px}
h1{font-size:20px;margin:0 0 12px}h2{font-size:16px;margin:0 0 10px}p{margin:0 0 10px}.muted{color:#51635A}
table{width:100%;border-collapse:collapse}th{font-size:13px;text-align:left;color:#51635A;padding:8px 10px;border-bottom:1.5px solid #DCE5E0}
td{padding:10px;border-bottom:1px solid #E6ECE8;vertical-align:middle}tr:last-child td{border-bottom:0}
.code{font:700 22px/1 ui-monospace,Consolas,monospace;letter-spacing:3px}
input,select{font:inherit;padding:9px 11px;border:1.5px solid #B9C7BF;border-radius:10px;background:#fff;color:inherit;max-width:100%}
button,.btn{font:600 14px/1 inherit;padding:10px 14px;border-radius:10px;border:1.5px solid #B9C7BF;background:#fff;color:#0B1F17;cursor:pointer;text-decoration:none;display:inline-block}
button.go,.btn.go{background:#00D27A;border-color:#00D27A}button.bad{color:#B3261E}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}label{display:block;font-weight:600;font-size:13px;color:#51635A;margin:10px 0 4px}
.pill{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12.5px;font-weight:600;background:#E8EDEA}.pill.pro{background:#D5F5E3;color:#007A48}
.note{background:#D5F5E3;border-radius:10px;padding:10px 14px;margin-bottom:16px}.warn{background:#FFF4E8;border:1px solid #F3C9A4;border-radius:10px;padding:10px 14px;margin-bottom:16px}
.wrap{overflow-x:auto}form.inline{display:inline}';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">'
        . '<title>' . h($title) . ' · BillKul admin</title><style>' . $css . '</style></head><body>' . $body . '</body></html>';
    exit;
}

$post = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($post && !hash_equals(csrf(), (string) ($_POST['csrf'] ?? ''))) {
    http_response_code(400);
    page('Try again', '<main><div class="card"><h1>This page was open too long</h1><p><a href="./">Go back and try again.</a></p></div></main>');
}
$action = $post ? (string) ($_POST['action'] ?? '') : '';
$note = (string) ($_SESSION['note'] ?? '');
unset($_SESSION['note']);
$noteHtml = $note !== '' ? '<div class="note">' . h($note) . '</div>' : '';

// ---- first visit: choose the admin password ----

if (!config()) {
    $problem = '';
    if (!extension_loaded('pdo_sqlite')) {
        $problem = 'This hosting has no SQLite support in PHP (pdo_sqlite), which BillKul needs. Turn it on in the hosting panel under "Select PHP version", or ask the hosting company.';
    } elseif (version_compare(PHP_VERSION, '7.4', '<')) {
        $problem = 'This hosting runs PHP ' . PHP_VERSION . '. BillKul needs PHP 7.4 or newer; change it in the hosting panel.';
    }
    $error = '';
    if ($action === 'setup' && $problem === '') {
        $one = (string) ($_POST['password'] ?? '');
        if (strlen($one) < 10) {
            $error = 'Use at least 10 characters.';
        } elseif ($one !== (string) ($_POST['again'] ?? '')) {
            $error = 'The two passwords are not the same.';
        } else {
            ensure_data_dir();
            if (!is_writable(data_dir())) {
                $error = 'The server cannot write to its data folder. Set the "api" folder permissions to 755 in the file manager.';
            } else {
                save_config([
                    'secret' => bin2hex(random_bytes(32)),
                    'db_file' => 'db-' . bin2hex(random_bytes(8)) . '.sqlite',
                    'admin_hash' => password_hash($one, PASSWORD_DEFAULT),
                    'created_at' => time(),
                ]);
                session_regenerate_id(true);
                $_SESSION['admin'] = true;
                header('Location: ./?tab=settings', true, 303);
                exit;
            }
        }
    }
    $body = '<div class="top"><b>Bill<span>Kul</span> admin</b></div><main><div class="card"><h1>Set up the BillKul server</h1>';
    if ($problem !== '') {
        $body .= '<div class="warn">' . h($problem) . '</div>';
    } else {
        $body .= '<p class="muted">Choose the password for this admin page. Only you should know it. Write it down somewhere safe: it is not shown again.</p>'
            . ($error !== '' ? '<div class="warn">' . h($error) . '</div>' : '')
            . '<form method="post">' . field() . '<input type="hidden" name="action" value="setup">'
            . '<label for="p1">Admin password (10 characters or more)</label><input id="p1" type="password" name="password" autocomplete="new-password" required minlength="10" size="32">'
            . '<label for="p2">The same password again</label><input id="p2" type="password" name="again" autocomplete="new-password" required minlength="10" size="32">'
            . '<p style="margin-top:14px"><button class="go">Create the server</button></p></form>';
    }
    page('Set up', $body . '</div></main>');
}

$config = config();
$pdo = db();

// ---- sign in ----

if ($action === 'login') {
    if (!allow('admin:' . client_ip(), 8, 900)) {
        $_SESSION['note'] = 'Too many tries. Wait 15 minutes.';
    } elseif (password_verify((string) ($_POST['password'] ?? ''), (string) $config['admin_hash'])) {
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
    } else {
        $_SESSION['note'] = 'That password is not right.';
    }
    header('Location: ./', true, 303);
    exit;
}

if (empty($_SESSION['admin'])) {
    page('Sign in', '<div class="top"><b>Bill<span>Kul</span> admin</b></div><main><div class="card"><h1>Sign in</h1>'
        . ($note !== '' ? '<div class="warn">' . h($note) . '</div>' : '')
        . '<form method="post">' . field() . '<input type="hidden" name="action" value="login">'
        . '<label for="p">Admin password</label><input id="p" type="password" name="password" autocomplete="current-password" required autofocus size="32">'
        . '<p style="margin-top:14px"><button class="go">Sign in</button></p></form></div></main>');
}

// ---- actions ----

$phoneIn = normalize_phone((string) ($_POST['phone'] ?? ''));

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    header('Location: ./', true, 303);
    exit;
}
if ($action === 'make_pro' && $phoneIn) {
    $months = (int) ($_POST['months'] ?? 0);
    $until = $months > 0 ? strtotime("+$months months") : null;
    if (!find_account($phoneIn)) {
        // Pro can be given before the customer has signed in for the first time.
        $pdo->prepare('INSERT INTO accounts (phone, created_at, seen_at) VALUES (?, ?, 0)')->execute([$phoneIn, time()]);
    }
    $pdo->prepare('UPDATE accounts SET plan = ?, pro_until = ? WHERE phone = ?')->execute(['pro', $until, $phoneIn]);
    back('accounts', "$phoneIn is now Pro" . ($until ? ' until ' . gmdate('j M Y', $until) : ' with no end date') . '.');
}
if ($action === 'make_free' && $phoneIn) {
    $pdo->prepare('UPDATE accounts SET plan = ?, pro_until = NULL WHERE phone = ?')->execute(['free', $phoneIn]);
    back('accounts', "$phoneIn is back on Free.");
}
if ($action === 'sign_out_everywhere' && $phoneIn) {
    $pdo->prepare('DELETE FROM tokens WHERE account_id = (SELECT id FROM accounts WHERE phone = ?)')->execute([$phoneIn]);
    back('accounts', "$phoneIn was signed out on every device.");
}
if ($action === 'drop_code' && $phoneIn) {
    $pdo->prepare('DELETE FROM codes WHERE phone = ?')->execute([$phoneIn]);
    back('codes');
}
if ($action === 'add_test') {
    $code = preg_replace('/\D+/', '', (string) ($_POST['code'] ?? ''));
    if (!$phoneIn) {
        back('tests', 'That is not a mobile number. Write it like +923001234567 or 03001234567.');
    }
    if (strlen((string) $code) !== 6) {
        back('tests', 'The code must be 6 digits.');
    }
    $pdo->prepare('INSERT OR REPLACE INTO test_numbers (phone, code, note) VALUES (?, ?, ?)')->execute([$phoneIn, $code, substr(trim((string) ($_POST['note'] ?? '')), 0, 60)]);
    back('tests', "$phoneIn can now sign in with the code $code.");
}
if ($action === 'remove_test' && $phoneIn) {
    $pdo->prepare('DELETE FROM test_numbers WHERE phone = ?')->execute([$phoneIn]);
    back('tests', "$phoneIn is no longer a test number.");
}
if ($action === 'save_settings') {
    $support = (string) ($_POST['support_whatsapp'] ?? '');
    $supportPhone = $support === '' ? '' : normalize_phone($support);
    if ($supportPhone === null) {
        back('settings', 'The WhatsApp number is not a mobile number. Write it like +923001234567.');
    }
    $email = trim((string) ($_POST['notify_email'] ?? ''));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        back('settings', 'That email address does not look right.');
    }
    $google = trim((string) ($_POST['google_client_id'] ?? ''));
    if ($google !== '' && !preg_match('/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/', $google)) {
        back('settings', 'That does not look like a Google client ID. It ends with .apps.googleusercontent.com.');
    }
    set_setting('google_client_id', $google);
    set_setting('support_whatsapp', (string) $supportPhone);
    set_setting('notify_email', $email);
    set_setting('limit_docs', (string) max(0, min(100000, (int) ($_POST['limit_docs'] ?? DEFAULT_LIMIT))));
    set_setting('limit_cash', (string) max(0, min(100000, (int) ($_POST['limit_cash'] ?? DEFAULT_LIMIT))));
    back('settings', 'Saved.');
}
if ($action === 'change_password') {
    $new = (string) ($_POST['password'] ?? '');
    if (!password_verify((string) ($_POST['current'] ?? ''), (string) $config['admin_hash'])) {
        back('settings', 'The current password is not right.');
    }
    if (strlen($new) < 10 || $new !== (string) ($_POST['again'] ?? '')) {
        back('settings', 'The new password needs 10 characters or more, typed the same twice.');
    }
    $config['admin_hash'] = password_hash($new, PASSWORD_DEFAULT);
    save_config($config);
    back('settings', 'The password was changed.');
}
if ($post) {
    back((string) ($_POST['tab'] ?? ''));
}

// ---- pages ----

$tab = (string) ($_GET['tab'] ?? 'codes');
if (!in_array($tab, ['codes', 'accounts', 'tests', 'settings'], true)) {
    $tab = 'codes';
}
$waiting = (int) $pdo->query('SELECT COUNT(*) FROM codes WHERE code_plain IS NOT NULL AND expires_at > ' . time())->fetchColumn();
$link = static function (string $name, string $label) use ($tab): string {
    return '<a class="' . ($tab === $name ? 'on' : '') . '" href="?tab=' . $name . '">' . h($label) . '</a>';
};
$top = '<div class="top"><b>Bill<span>Kul</span> admin</b>'
    . $link('codes', 'Codes to send' . ($waiting ? " ($waiting)" : '')) . $link('accounts', 'Accounts') . $link('tests', 'Test numbers') . $link('settings', 'Settings')
    . '<form method="post">' . field() . '<input type="hidden" name="action" value="logout"><button>Close admin</button></form></div>';

$body = $noteHtml;

if ($tab === 'codes') {
    header('Refresh: 20');
    $rows = $pdo->query('SELECT * FROM codes WHERE code_plain IS NOT NULL AND expires_at > ' . time() . ' ORDER BY created_at DESC')->fetchAll();
    $body .= '<div class="card"><h1>Codes to send</h1><p class="muted">When someone enters their number in the app, their code appears here. Tap "Send on WhatsApp" and it opens your own WhatsApp with the message ready. A code works for 10 minutes. This page refreshes itself every 20 seconds.</p>';
    if (!$rows) {
        $body .= '<p>No one is waiting for a code.</p>';
    } else {
        $body .= '<div class="wrap"><table><tr><th>Number</th><th>Code</th><th>Asked</th><th></th></tr>';
        foreach ($rows as $row) {
            $message = "Your BillKul code is {$row['code_plain']}. It works for 10 minutes. Do not share it with anyone.\n\nآپ کا BillKul کوڈ {$row['code_plain']} ہے۔ یہ 10 منٹ تک کارآمد ہے۔";
            $wa = 'https://wa.me/' . ltrim($row['phone'], '+') . '?text=' . rawurlencode($message);
            $left = max(1, (int) ceil(((int) $row['expires_at'] - time()) / 60));
            $body .= '<tr><td>' . h($row['phone']) . '</td><td class="code">' . h($row['code_plain']) . '</td><td>' . h(ago((int) $row['created_at'])) . '<br><span class="muted">' . $left . ' min left</span></td>'
                . '<td><div class="row"><a class="btn go" target="_blank" rel="noopener noreferrer" href="' . h($wa) . '">Send on WhatsApp</a>'
                . '<form class="inline" method="post">' . field() . '<input type="hidden" name="action" value="drop_code"><input type="hidden" name="phone" value="' . h($row['phone']) . '"><button>Remove</button></form></div></td></tr>';
        }
        $body .= '</table></div>';
    }
    $body .= '</div>';
}

if ($tab === 'accounts') {
    $search = preg_replace('/[^0-9+]/', '', (string) ($_GET['q'] ?? ''));
    $total = (int) $pdo->query('SELECT COUNT(*) FROM accounts')->fetchColumn();
    $pros = (int) $pdo->query("SELECT COUNT(*) FROM accounts WHERE plan = 'pro' AND (pro_until IS NULL OR pro_until >= " . time() . ')')->fetchColumn();
    $q = $pdo->prepare('SELECT * FROM accounts WHERE phone LIKE ? ORDER BY seen_at DESC, id DESC LIMIT 200');
    $q->execute(['%' . ltrim((string) $search, '0') . '%']);
    $rows = $q->fetchAll();
    $limits = free_limits();
    $body .= '<div class="card"><h1>Accounts</h1><p class="muted">' . $total . ($total === 1 ? ' account, ' : ' accounts, ') . $pros . ' on Pro. Free allows ' . $limits['docs'] . ' quotations and invoices and ' . $limits['cash'] . ' cash book entries.</p>'
        . '<form method="get" class="row"><input type="hidden" name="tab" value="accounts"><input name="q" value="' . h($search) . '" placeholder="Search a number" inputmode="tel"><button>Search</button></form></div>';

    $body .= '<div class="card"><h2>Give Pro to a number</h2><form method="post" class="row">' . field() . '<input type="hidden" name="action" value="make_pro">'
        . '<input name="phone" placeholder="+923001234567" inputmode="tel" required>'
        . '<select name="months"><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12" selected>12 months</option><option value="0">No end date</option></select>'
        . '<button class="go">Make Pro</button></form></div>';

    $body .= '<div class="card"><div class="wrap"><table><tr><th>Number</th><th>Plan</th><th>Used</th><th>Joined</th><th>Last seen</th><th></th></tr>';
    if (!$rows) {
        $body .= '<tr><td colspan="6">No accounts' . ($search !== '' ? ' match that number' : ' yet') . '.</td></tr>';
    }
    foreach ($rows as $row) {
        $pro = is_pro($row);
        $plan = $pro ? '<span class="pill pro">Pro</span>' . ($row['pro_until'] !== null ? '<br><span class="muted">until ' . gmdate('j M Y', (int) $row['pro_until']) . '</span>' : '') : '<span class="pill">Free</span>';
        $hidden = field() . '<input type="hidden" name="phone" value="' . h($row['phone']) . '">';
        $buttons = $pro
            ? '<form class="inline" method="post">' . $hidden . '<input type="hidden" name="action" value="make_free"><button>Back to Free</button></form>'
            : '<form class="inline" method="post">' . $hidden . '<input type="hidden" name="action" value="make_pro"><input type="hidden" name="months" value="12"><button class="go">Pro, 12 months</button></form>';
        $buttons .= ' <form class="inline" method="post">' . $hidden . '<input type="hidden" name="action" value="sign_out_everywhere"><button title="Signs this number out of the app on every device">Sign out of app</button></form>';
        $body .= '<tr><td><a href="https://wa.me/' . h(ltrim($row['phone'], '+')) . '" target="_blank" rel="noopener noreferrer">' . h($row['phone']) . '</a>'
            . ($row['platform'] !== '' ? '<br><span class="muted">' . h($row['platform'] . ' ' . $row['app_version']) . '</span>' : '') . '</td>'
            . '<td>' . $plan . '</td><td>' . (int) $row['docs_used'] . ' documents<br>' . (int) $row['cash_used'] . ' cash entries</td>'
            . '<td>' . h(gmdate('j M Y', (int) $row['created_at'])) . '</td><td>' . ((int) $row['seen_at'] ? h(ago((int) $row['seen_at'])) : '<span class="muted">not yet</span>') . '</td>'
            . '<td><div class="row">' . $buttons . '</div></td></tr>';
    }
    $body .= '</table></div></div>';
}

if ($tab === 'tests') {
    $rows = $pdo->query('SELECT * FROM test_numbers ORDER BY phone')->fetchAll();
    $body .= '<div class="card"><h1>Test numbers</h1><p class="muted">A test number always signs in with the code you set here, and nothing is sent to it. Use it for Google\'s reviewers and for testers you trust. Anyone who knows the number and its code can sign in as that number, so remove test numbers you no longer need.</p>'
        . '<form method="post" class="row">' . field() . '<input type="hidden" name="action" value="add_test">'
        . '<input name="phone" placeholder="+923001234567" inputmode="tel" required><input name="code" placeholder="6-digit code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required size="12"><input name="note" placeholder="Who is it for" maxlength="60">'
        . '<button class="go">Add</button></form></div>';
    $body .= '<div class="card"><div class="wrap"><table><tr><th>Number</th><th>Code</th><th>For</th><th></th></tr>';
    if (!$rows) {
        $body .= '<tr><td colspan="4">No test numbers.</td></tr>';
    }
    foreach ($rows as $row) {
        $body .= '<tr><td>' . h($row['phone']) . '</td><td class="code">' . h($row['code']) . '</td><td>' . h($row['note']) . '</td><td><form class="inline" method="post">' . field()
            . '<input type="hidden" name="action" value="remove_test"><input type="hidden" name="phone" value="' . h($row['phone']) . '"><button class="bad">Remove</button></form></td></tr>';
    }
    $body .= '</table></div></div>';
}

if ($tab === 'settings') {
    $limits = free_limits();
    $body .= '<div class="card"><h1>Settings</h1><form method="post">' . field() . '<input type="hidden" name="action" value="save_settings">'
        . '<label for="sw">Your WhatsApp number for customers who want Pro</label><input id="sw" name="support_whatsapp" value="' . h(setting('support_whatsapp')) . '" placeholder="+923001234567" inputmode="tel" size="24">'
        . '<p class="muted">The app shows a "Contact us on WhatsApp" button with this number when a free user reaches the limit.</p>'
        . '<label for="ne">Email me when someone asks for a code (optional)</label><input id="ne" type="email" name="notify_email" value="' . h(setting('notify_email')) . '" size="32">'
        . '<p class="muted">Not every hosting delivers this email, and it can land in spam. The "Codes to send" page always shows the code.</p>'
        . '<label for="gc">Google client ID for Drive backup (Web application type)</label><input id="gc" name="google_client_id" value="' . h(setting('google_client_id')) . '" placeholder="123456789-abc.apps.googleusercontent.com" size="60">'
        . '<p class="muted">Leave empty until Google Cloud is set up. When it is filled in, the app offers automatic backup to the user\'s Google Drive.</p>'
        . '<div class="row"><div><label for="ld">Free quotations and invoices</label><input id="ld" type="number" min="0" name="limit_docs" value="' . $limits['docs'] . '" style="width:110px"></div>'
        . '<div><label for="lc">Free cash book entries</label><input id="lc" type="number" min="0" name="limit_cash" value="' . $limits['cash'] . '" style="width:110px"></div></div>'
        . '<p style="margin-top:14px"><button class="go">Save</button></p></form></div>';
    $body .= '<div class="card"><h2>Change the admin password</h2><form method="post">' . field() . '<input type="hidden" name="action" value="change_password">'
        . '<label for="c0">Current password</label><input id="c0" type="password" name="current" autocomplete="current-password" required size="32">'
        . '<label for="c1">New password (10 characters or more)</label><input id="c1" type="password" name="password" autocomplete="new-password" required minlength="10" size="32">'
        . '<label for="c2">New password again</label><input id="c2" type="password" name="again" autocomplete="new-password" required minlength="10" size="32">'
        . '<p style="margin-top:14px"><button>Change password</button></p></form></div>';
    $body .= '<div class="card"><h2>About this server</h2><p class="muted">PHP ' . h(PHP_VERSION) . ', SQLite ' . h((string) $pdo->query('SELECT sqlite_version()')->fetchColumn())
        . '. Sign-in codes are sent by you from the "Codes to send" page until the official WhatsApp service is connected.</p></div>';
}

page('Admin', $top . '<main>' . $body . '</main>');
