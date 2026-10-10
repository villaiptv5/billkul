<?php
/**
 * End-to-end tests for the BillKul account server.
 * Starts PHP's own web server on a spare port with an empty data folder and plays the app and the owner.
 *
 *   php server/tests/run.php
 */
declare(strict_types=1);

$port = 8700 + random_int(0, 200);
$data = sys_get_temp_dir() . '/billkul-test-' . bin2hex(random_bytes(4));
$base = "http://127.0.0.1:$port";
$server = proc_open(
    ['php', '-S', "127.0.0.1:$port", '-t', __DIR__ . '/../api'],
    [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
    $pipes,
    null,
    ['BILLKUL_DATA' => $data, 'PATH' => getenv('PATH')]
);
register_shutdown_function(static function () use ($server, $data) {
    proc_terminate($server);
    foreach (glob("$data/{,.}[!.]*", GLOB_BRACE) ?: [] as $file) {
        @unlink($file);
    }
    @rmdir($data);
});
usleep(600000);

$passed = 0;
$failed = 0;
function check(bool $ok, string $what): void
{
    global $passed, $failed;
    $ok ? $passed++ : $failed++;
    echo ($ok ? 'PASS ' : 'FAIL ') . $what . "\n";
}

/** The app: JSON in, JSON out. */
function api(string $route, ?array $body = null, string $ip = ''): array
{
    global $base;
    $ch = curl_init("$base/index.php?r=$route");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $text = (string) curl_exec($ch);
    $json = json_decode($text, true);
    return (is_array($json) ? $json : ['raw' => $text]) + ['status' => curl_getinfo($ch, CURLINFO_RESPONSE_CODE)];
}

/** The owner's browser: keeps cookies, follows redirects, sends the form token it last saw. */
function admin(string $query = '', ?array $form = null): string
{
    global $base;
    static $jar = null, $csrf = '';
    $jar = $jar ?? tempnam(sys_get_temp_dir(), 'bkjar');
    $ch = curl_init("$base/admin/index.php$query");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_FOLLOWLOCATION => true]);
    if ($form !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($form + ['csrf' => $csrf]));
    }
    $html = (string) curl_exec($ch);
    if (preg_match('/name="csrf" value="([a-f0-9]+)"/', $html, $m)) {
        $csrf = $m[1];
    }
    return $html;
}

function db(): PDO
{
    global $data;
    $config = include "$data/config.php";
    return new PDO('sqlite:' . "$data/" . $config['db_file']);
}

function code_for(string $phone): string
{
    return (string) db()->query("SELECT code_plain FROM codes WHERE phone = '$phone'")->fetchColumn();
}

// ---- before setup ----
check(api('ping')['error'] === 'setup', 'before setup the app is told the server is not ready');
check(strpos(admin(), 'Set up the BillKul server') !== false, 'the first visit to the admin page asks for a password');
check(strpos(admin('', ['action' => 'setup', 'password' => 'short', 'again' => 'short']), 'at least 10 characters') !== false, 'a short admin password is refused');
check(strpos(admin('', ['action' => 'setup', 'password' => 'correct horse 42', 'again' => 'different one']), 'not the same') !== false, 'mismatched passwords are refused');
$html = admin('', ['action' => 'setup', 'password' => 'correct horse 42', 'again' => 'correct horse 42']);
check(strpos($html, 'Settings') !== false && is_file("$data/config.php"), 'setup creates the server and signs the owner in');
check(is_file("$data/.htaccess") && strpos((string) file_get_contents("$data/.htaccess"), 'denied') !== false, 'the data folder is closed to visitors');
check(api('ping')['ok'] === true, 'after setup the app can reach the server');

// ---- asking for a code ----
check(api('auth/request', ['phone' => 'hello'])['error'] === 'bad_phone', 'a word is not a phone number');
check(api('auth/request', ['phone' => '+92 21 1234567'])['error'] === 'bad_phone', 'a Pakistani landline is refused');
$r = api('auth/request', ['phone' => '0300 1234567']);
check($r['ok'] === true && $r['delivery'] === 'manual' && $r['wait'] === 60, 'a local number gets a code, to be sent by the owner');
$code = code_for('+923001234567');
check((bool) preg_match('/^\d{6}$/', $code), 'the code is 6 digits and stored under the international number');
$r = api('auth/request', ['phone' => '+923001234567']);
check($r['error'] === 'wait' && $r['wait'] > 0 && $r['status'] === 429, 'asking again within a minute is refused');
check(strpos(admin('?tab=codes'), $code) !== false && strpos(admin('?tab=codes'), 'wa.me/923001234567?text=') !== false, 'the owner sees the code with a WhatsApp link');

// ---- checking the code ----
$wrong = $code === '111111' ? '222222' : '111111';
$r = api('auth/verify', ['phone' => '03001234567', 'code' => $wrong]);
check($r['error'] === 'bad_code' && $r['triesLeft'] === 4, 'a wrong code is refused and tries are counted');
$r = api('auth/verify', ['phone' => '03001234567', 'code' => $code, 'device' => 'android']);
$token = $r['token'] ?? '';
check($r['ok'] === true && strlen($token) === 64 && $r['account']['phone'] === '+923001234567', 'the right code signs in');
check($r['account']['plan'] === 'free' && $r['account']['limits'] === ['docs' => 10, 'cash' => 10], 'a new account is Free with 10 and 10');
check(api('auth/verify', ['phone' => '03001234567', 'code' => $code])['error'] === 'expired', 'a code cannot be used twice');
check(strpos(admin('?tab=codes'), 'No one is waiting') !== false, 'a used code leaves the owner\'s list');
check((string) db()->query('SELECT hash FROM tokens')->fetchColumn() !== $token, 'the sign-in token is not stored as it is');

// five wrong guesses end a code
db()->exec("DELETE FROM codes; DELETE FROM throttle");
api('auth/request', ['phone' => '+923111111111']);
$real = code_for('+923111111111');
$guess = $real === '000000' ? '999999' : '000000';
for ($i = 0; $i < 5; $i++) {
    $r = api('auth/verify', ['phone' => '+923111111111', 'code' => $guess]);
}
check($r['error'] === 'bad_code' && $r['triesLeft'] === 0, 'the fifth wrong guess is the last');
check(api('auth/verify', ['phone' => '+923111111111', 'code' => $real])['error'] === 'expired', 'after five wrong guesses even the right code is dead');

// an old code stops working
db()->exec("DELETE FROM codes; DELETE FROM throttle");
api('auth/request', ['phone' => '+923111111111']);
$real = code_for('+923111111111');
db()->exec('UPDATE codes SET expires_at = ' . (time() - 1));
check(api('auth/verify', ['phone' => '+923111111111', 'code' => $real])['error'] === 'expired', 'a code older than 10 minutes is refused');

// too many requests for one number
db()->exec("DELETE FROM codes; DELETE FROM throttle");
for ($i = 0; $i < 6; $i++) {
    $r = api('auth/request', ['phone' => '+923222222222']);
    db()->exec('UPDATE codes SET created_at = created_at - 120');
}
check($r['error'] === 'too_many', 'a number can ask for 5 codes an hour, not 6');
db()->exec("DELETE FROM codes; DELETE FROM throttle");

// ---- the account ----
$r = api('account/sync', ['token' => $token, 'docsUsed' => 7, 'cashUsed' => 3, 'appVersion' => '1.0.0', 'platform' => 'android']);
check($r['ok'] === true && $r['account']['docsUsed'] === 7 && $r['account']['cashUsed'] === 3, 'the app reports how much of the free allowance is used');
$r = api('account/sync', ['token' => $token, 'docsUsed' => 0, 'cashUsed' => 0]);
check($r['account']['docsUsed'] === 7 && $r['account']['cashUsed'] === 3, 'the counts never go down, so reinstalling gives nothing back');
check(api('account/sync', ['token' => str_repeat('a', 64)])['error'] === 'signed_out', 'an unknown token is signed out');
check(api('account/sync', ['token' => "x' OR '1'='1"])['error'] === 'signed_out', 'a crafted token gets nowhere');

// ---- the owner switches Pro on and off ----
$html = admin('?tab=accounts');
check(strpos($html, '+923001234567') !== false && strpos($html, '7 documents') !== false, 'the owner sees the account and its usage');
$html = admin('', ['action' => 'make_pro', 'phone' => '0300 1234567', 'months' => '12']);
check(strpos($html, 'is now Pro until') !== false, 'the owner gives Pro for 12 months');
$r = api('account/sync', ['token' => $token]);
check($r['account']['plan'] === 'pro' && (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $r['account']['proUntil']), 'the app learns it is Pro, and until when');
db()->exec('UPDATE accounts SET pro_until = ' . (time() - 60));
check(api('account/sync', ['token' => $token])['account']['plan'] === 'free', 'Pro ends by itself on its end date');
admin('', ['action' => 'make_pro', 'phone' => '+923001234567', 'months' => '0']);
$r = api('account/sync', ['token' => $token]);
check($r['account']['plan'] === 'pro' && $r['account']['proUntil'] === '', 'Pro can be given with no end date');
admin('', ['action' => 'make_free', 'phone' => '+923001234567']);
check(api('account/sync', ['token' => $token])['account']['plan'] === 'free', 'the owner puts the account back on Free');
admin('', ['action' => 'make_pro', 'phone' => '+923339999999', 'months' => '1']);
check((int) db()->query("SELECT COUNT(*) FROM accounts WHERE phone = '+923339999999' AND plan = 'pro'")->fetchColumn() === 1, 'Pro can be given before the customer first signs in');

// ---- settings reach the app ----
admin('', ['action' => 'save_settings', 'support_whatsapp' => '0331 8222236', 'notify_email' => '', 'limit_docs' => '10', 'limit_cash' => '25']);
$r = api('account/sync', ['token' => $token]);
check($r['account']['supportWhatsapp'] === '+923318222236' && $r['account']['limits']['cash'] === 25, 'the support number and the limits reach the app');
check(strpos(admin('', ['action' => 'save_settings', 'support_whatsapp' => 'abc', 'limit_docs' => '10', 'limit_cash' => '10']), 'not a mobile number') !== false, 'a bad support number is refused');
check(strpos(admin('', ['action' => 'save_settings', 'support_whatsapp' => '', 'google_client_id' => 'hello', 'limit_docs' => '10', 'limit_cash' => '25']), 'Google client ID') !== false, 'a wrong Google client ID is refused');
admin('', ['action' => 'save_settings', 'support_whatsapp' => '0331 8222236', 'google_client_id' => '1234567890-abcdef123.apps.googleusercontent.com', 'limit_docs' => '10', 'limit_cash' => '25']);
check(api('account/sync', ['token' => $token])['account']['googleClientId'] === '1234567890-abcdef123.apps.googleusercontent.com', 'the Google client ID reaches the app');

// ---- test numbers ----
check(strpos(admin('', ['action' => 'add_test', 'phone' => '+923005550000', 'code' => '12', 'note' => 'x']), 'must be 6 digits') !== false, 'a test code must be 6 digits');
admin('', ['action' => 'add_test', 'phone' => '0300 5550000', 'code' => '246810', 'note' => 'Google review']);
$r = api('auth/request', ['phone' => '+923005550000']);
check($r['ok'] === true && $r['delivery'] === 'test', 'a test number is recognised');
check(strpos(admin('?tab=codes'), '246810') === false, 'a test number\'s code is not listed for sending');
check(api('auth/verify', ['phone' => '+923005550000', 'code' => '246810'])['ok'] === true, 'a test number signs in with its fixed code');
admin('', ['action' => 'remove_test', 'phone' => '+923005550000']);
db()->exec("DELETE FROM codes; DELETE FROM throttle");
check(api('auth/request', ['phone' => '+923005550000'])['delivery'] === 'manual', 'a removed test number is an ordinary number again');

// ---- signing out ----
admin('', ['action' => 'sign_out_everywhere', 'phone' => '+923001234567']);
check(api('account/sync', ['token' => $token])['error'] === 'signed_out', 'the owner can sign a number out everywhere');
db()->exec("DELETE FROM codes; DELETE FROM throttle");
api('auth/request', ['phone' => '+923001234567']);
$r = api('auth/verify', ['phone' => '+923001234567', 'code' => code_for('+923001234567')]);
$token = $r['token'];
check($r['account']['docsUsed'] === 7, 'signing in again brings the old counts back');
api('auth/logout', ['token' => $token]);
check(api('account/sync', ['token' => $token])['error'] === 'signed_out', 'signing out in the app ends that sign-in');

// ---- passwords ----
db()->exec("DELETE FROM codes; DELETE FROM throttle");
check(api('auth/start', ['phone' => '0300 1234567'])['hasPassword'] === false, 'a number without a password is told to use a code');
check(api('auth/start', ['phone' => '0399 0000000'])['hasPassword'] === false, 'so is a number that has never signed up');
check(api('auth/password', ['phone' => '+923001234567', 'password' => 'whatever'])['error'] === 'no_password', 'signing in with a password before setting one is refused');
api('auth/request', ['phone' => '+923001234567']);
$fresh = api('auth/verify', ['phone' => '+923001234567', 'code' => code_for('+923001234567')]);
check($fresh['account']['hasPassword'] === false, 'after a code the app learns that no password is set yet');
check(api('account/password', ['token' => $fresh['token'], 'password' => '12345'])['error'] === 'weak_password', 'a password shorter than 6 is refused');
$set = api('account/password', ['token' => $fresh['token'], 'password' => 'shop2026']);
check($set['ok'] === true && $set['account']['hasPassword'] === true, 'right after a code, a password can be set');
check((string) db()->query("SELECT password_hash FROM accounts WHERE phone = '+923001234567'")->fetchColumn() !== 'shop2026', 'the password is not stored as it is');
check(api('auth/start', ['phone' => '03001234567'])['hasPassword'] === true, 'the number now signs in with its password');
$r = api('auth/password', ['phone' => '0300 1234567', 'password' => 'wrong one']);
check($r['error'] === 'bad_password' && $r['triesLeft'] === 9, 'a wrong password is refused and counted');
$r = api('auth/password', ['phone' => '0300 1234567', 'password' => 'shop2026', 'device' => 'android']);
check($r['ok'] === true && strlen($r['token']) === 64 && $r['account']['docsUsed'] === 7, 'the right password signs in without a code');
$byPassword = $r['token'];
check(api('account/password', ['token' => $byPassword, 'password' => 'newpass99'])['error'] === 'bad_password', 'changing it later needs the current password');
check(api('account/password', ['token' => $byPassword, 'password' => 'newpass99', 'current' => 'shop2026'])['ok'] === true, 'with the current password it changes');
check(api('account/sync', ['token' => $fresh['token']])['error'] === 'signed_out', 'a new password signs out the other devices');
check(api('account/sync', ['token' => $byPassword])['ok'] === true, 'but not the device that changed it');
db()->exec("DELETE FROM throttle");
for ($i = 0; $i < 10; $i++) {
    api('auth/password', ['phone' => '+923001234567', 'password' => 'guess' . $i]);
}
check(api('auth/password', ['phone' => '+923001234567', 'password' => 'newpass99'])['error'] === 'too_many', 'after 10 wrong passwords the number is locked for an hour');
api('auth/request', ['phone' => '+923001234567']);
$forgot = api('auth/verify', ['phone' => '+923001234567', 'code' => code_for('+923001234567')]);
check(api('account/password', ['token' => $forgot['token'], 'password' => 'remembered1'])['ok'] === true, 'a forgotten password is replaced after signing in with a code');
db()->exec("DELETE FROM throttle");
check(api('auth/password', ['phone' => '+923001234567', 'password' => 'remembered1'])['ok'] === true, 'and the new one works');
$token = $forgot['token'];

// ---- deleting an account ----
db()->exec("DELETE FROM codes; DELETE FROM throttle");
api('auth/request', ['phone' => '+923001234567']);
$token = api('auth/verify', ['phone' => '+923001234567', 'code' => code_for('+923001234567')])['token'];
check(api('account/delete', ['token' => $token])['ok'] === true, 'the app can delete its account');
check((int) db()->query("SELECT COUNT(*) FROM accounts WHERE phone = '+923001234567'")->fetchColumn() === 0, 'the number is gone from the accounts');
check(api('account/sync', ['token' => $token])['error'] === 'signed_out', 'a deleted account is signed out');
db()->exec("DELETE FROM codes; DELETE FROM throttle");
api('auth/request', ['phone' => '+923001234567']);
$r = api('auth/verify', ['phone' => '+923001234567', 'code' => code_for('+923001234567')]);
$token = $r['token'];
check($r['account']['docsUsed'] === 7 && $r['account']['plan'] === 'free', 'signing up again after deleting does not give a new free allowance');

// ---- the same phone with another number ----
db()->exec('DELETE FROM throttle');
function sign_up(string $phone, string $deviceId): array
{
    api('auth/request', ['phone' => $phone]);
    return api('auth/verify', ['phone' => $phone, 'code' => code_for(normalize($phone)), 'device' => 'android', 'deviceId' => $deviceId]);
}
function normalize(string $phone): string
{
    return '+92' . substr(preg_replace('/\D+/', '', $phone), -10);
}
$phoneA = 'phone-aaaaaaaaaaaaaaaa';
$a = sign_up('0311 1111111', $phoneA);
check($a['ok'] === true && $a['account']['docsUsed'] === 0, 'a first number on a phone starts at 0');
$r = api('account/sync', ['token' => $a['token'], 'docsUsed' => 5, 'cashUsed' => 3, 'deviceId' => $phoneA]);
check($r['account']['docsUsed'] === 5, 'the phone uses up 5 documents');
check((int) db()->query('SELECT COUNT(*) FROM device_usage')->fetchColumn() >= 1 && (int) db()->query("SELECT COUNT(*) FROM device_usage WHERE device_hash LIKE '%aaaa%'")->fetchColumn() === 0, 'the phone is kept only as a fingerprint');
$b = sign_up('0322 2222222', $phoneA);
check($b['account']['docsUsed'] === 5 && $b['account']['cashUsed'] === 3, 'a second number on the same phone starts where the phone was (5 and 3)');
$c = sign_up('0333 3333333', 'phone-bbbbbbbbbbbbbbbb');
check($c['account']['docsUsed'] === 0, 'a number on another phone starts at 0');
api('account/password', ['token' => $c['token'], 'password' => 'other123']);
$r = api('auth/password', ['phone' => '0333 3333333', 'password' => 'other123', 'device' => 'android', 'deviceId' => $phoneA]);
check($r['account']['docsUsed'] === 5, 'signing in with a password on a used phone also carries the count');
$r = api('account/sync', ['token' => $a['token'], 'docsUsed' => 0, 'deviceId' => 'bad id!']);
check($r['ok'] === true && $r['account']['docsUsed'] === 5, 'a strange phone ID is ignored, not an error');

// ---- moving an account to a new number ----
db()->exec('DELETE FROM throttle');
check(api('auth/start', ['phone' => '0322 2222222'])['exists'] === true && api('auth/start', ['phone' => '0344 4444444'])['exists'] === false, 'the app can see whether a number already has an account');
check(api('account/phone', ['token' => $a['token'], 'phone' => '0311 1111111', 'code' => '123456'])['error'] === 'same_phone', 'the same number is refused');
check(api('account/phone', ['token' => $a['token'], 'phone' => '0322 2222222', 'code' => '123456'])['error'] === 'number_taken', 'a number that has its own account is refused');
api('auth/request', ['phone' => '0344 4444444']);
$newCode = code_for('+923444444444');
check(api('account/phone', ['token' => $a['token'], 'phone' => '0344 4444444', 'code' => $newCode === '111111' ? '222222' : '111111'])['error'] === 'bad_code', 'a wrong code for the new number is refused');
$r = api('account/phone', ['token' => $a['token'], 'phone' => '0344 4444444', 'code' => $newCode, 'deviceId' => $phoneA]);
check($r['ok'] === true && $r['account']['phone'] === '+923444444444' && $r['account']['docsUsed'] === 5, 'the account moves to the new number with its count');
check(api('account/sync', ['token' => $a['token']])['account']['phone'] === '+923444444444', 'the device stays signed in after the move');
check(api('auth/start', ['phone' => '0311 1111111'])['exists'] === false, 'the old number no longer has an account');
$old = sign_up('0311 1111111', 'phone-cccccccccccccccc');
check($old['account']['docsUsed'] === 5, 'the old number, signed up again on another phone, starts at what it had used');

// ---- the owner moves a number for a customer who lost the SIM ----
$html = admin('', ['action' => 'move_number', 'phone' => '0344 4444444', 'new_phone' => '0322 2222222']);
check(strpos($html, 'already has its own account') !== false, 'admin: a number with its own account cannot be taken');
$html = admin('', ['action' => 'move_number', 'phone' => '0344 4444444', 'new_phone' => '0355 5555555']);
check(strpos($html, 'now belongs to +923555555555') !== false, 'admin: the account moves to the new number');
check(api('account/sync', ['token' => $a['token']])['error'] === 'signed_out', 'admin: after the move the old sign-ins end');
check(api('auth/start', ['phone' => '0355 5555555'])['exists'] === true, 'admin: the new number now has the account');

// ---- sync between a phone and a PC (Pro) ----
db()->exec('DELETE FROM throttle');
$shop = sign_up('0366 6666666', 'phone-dddddddddddddddd');
$phoneToken = $shop['token'];
check(api('sync/pull', ['token' => $phoneToken, 'since' => 0])['error'] === 'not_pro', 'sync: a Free account cannot sync');
db()->exec("UPDATE accounts SET plan = 'pro', pro_until = NULL WHERE phone = '+923666666666'");
api('account/password', ['token' => $phoneToken, 'password' => 'syncpass1']);
$pc = api('auth/password', ['phone' => '0366 6666666', 'password' => 'syncpass1', 'device' => 'web']);
$pcToken = $pc['token'];
$r = api('sync/push', ['token' => $phoneToken, 'changes' => [
    ['kind' => 'doc', 'id' => 'd1', 'body' => ['id' => 'd1', 'number' => 'INV-0001', 'lines' => [], 'extra' => new stdClass()]],
    ['kind' => 'settings', 'id' => 'shop', 'body' => ['shopName' => 'Al Noor', 'currency' => ['code' => 'PKR', 'symbol' => 'Rs']]],
]]);
check($r['ok'] === true && $r['rev'] === 2, 'sync: the phone pushes two records');
$r = api('sync/pull', ['token' => $pcToken, 'since' => 0]);
check(count($r['changes']) === 2 && $r['rev'] === 2 && $r['more'] === false, 'sync: the PC pulls them');
$doc = array_values(array_filter($r['changes'], fn ($c) => $c['id'] === 'd1'))[0];
check($doc['body']['number'] === 'INV-0001' && $doc['body']['lines'] === [] && $doc['body']['extra'] === [], 'sync: the record comes back as it was sent');
$raw = (string) db()->query("SELECT body FROM sync_records WHERE rid = 'd1'")->fetchColumn();
check(strpos($raw, '"extra":{}') !== false && strpos($raw, '"lines":[]') !== false, 'sync: an empty {} stays an object and [] a list');
api('sync/push', ['token' => $pcToken, 'changes' => [['kind' => 'doc', 'id' => 'd1', 'body' => null], ['kind' => 'customer', 'id' => 'c1', 'body' => ['id' => 'c1', 'name' => 'Ali']]]]);
$r = api('sync/pull', ['token' => $phoneToken, 'since' => 2]);
check(count($r['changes']) === 2 && $r['rev'] === 4, 'sync: the phone pulls only what changed since');
$del = array_values(array_filter($r['changes'], fn ($c) => $c['id'] === 'd1'))[0];
check($del['body'] === null, 'sync: a deleted record comes as empty');
check(api('sync/pull', ['token' => $phoneToken, 'since' => 4])['changes'] === [], 'sync: nothing new, nothing sent');
check(api('sync/push', ['token' => $pcToken, 'changes' => [['kind' => 'secret', 'id' => 'x', 'body' => ['a' => 1]]]])['error'] === 'bad_request', 'sync: an unknown kind is refused');
check(api('sync/push', ['token' => $pcToken, 'changes' => [['kind' => 'doc', 'id' => '../etc', 'body' => ['a' => 1]]]])['error'] === 'bad_request', 'sync: a strange id is refused');
$many = [];
for ($i = 0; $i < 450; $i++) {
    $many[] = ['kind' => 'item', 'id' => "i$i", 'body' => ['id' => "i$i", 'name' => "Item $i"]];
}
api('sync/push', ['token' => $pcToken, 'changes' => $many]);
$first = api('sync/pull', ['token' => $phoneToken, 'since' => 4]);
check(count($first['changes']) === 400 && $first['more'] === true, 'sync: a long list comes in pages');
$second = api('sync/pull', ['token' => $phoneToken, 'since' => $first['rev']]);
check(count($second['changes']) === 50 && $second['more'] === false, 'sync: and the rest on the next page');
check(api('sync/pull', ['token' => $a['token'] ?? 'x', 'since' => 0])['error'] === 'signed_out', 'sync: a signed-out device is refused');
api('account/delete', ['token' => $phoneToken]);
check((int) db()->query("SELECT COUNT(*) FROM sync_records")->fetchColumn() === 0, 'sync: deleting the account deletes its records');

// ---- the admin page is closed without the password ----
admin('', ['action' => 'logout']);
check(strpos(admin('?tab=accounts'), 'Admin password') !== false && strpos(admin('?tab=accounts'), '+923001234567') === false, 'signed out, the admin page shows nothing but the sign-in form');
check(strpos(admin('', ['action' => 'login', 'password' => 'wrong password']), 'not right') !== false, 'a wrong admin password is refused');
check(strpos(admin('', ['action' => 'login', 'password' => 'correct horse 42']), 'Codes to send') !== false, 'the right admin password signs in');
admin('', ['action' => 'logout']);
for ($i = 0; $i < 9; $i++) {
    $html = admin('', ['action' => 'login', 'password' => 'guess ' . $i]);
}
check(strpos($html, 'Too many tries') !== false, 'guessing the admin password is stopped after 8 tries');
check(strpos(admin('', ['action' => 'login', 'password' => 'correct horse 42']), 'Too many tries') !== false, 'and stays stopped for a while, even with the right password');

// a form without its token does nothing
$ch = curl_init("$base/admin/index.php");
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POSTFIELDS => 'action=make_pro&phone=%2B923001234567&months=0']);
curl_exec($ch);
check((string) db()->query("SELECT plan FROM accounts WHERE phone = '+923001234567'")->fetchColumn() === 'free', 'a forged form cannot switch Pro on');

// ---- nothing private can be fetched ----
$ch = curl_init("$base/lib.php");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$out = (string) curl_exec($ch);
check(curl_getinfo($ch, CURLINFO_RESPONSE_CODE) === 404 && $out === '', 'the shared code file answers nothing on its own');
check(api('nothing/here', [])['error'] === 'not_found', 'an unknown route is refused');
check(api('auth/request')['error'] === 'post_only', 'reading instead of sending is refused');

echo "\n$passed passed, $failed failed\n";
exit($failed ? 1 : 0);
