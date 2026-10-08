<?php
/**
 * BillKul account server: shared code for the app's API (index.php) and the owner's admin page (admin/).
 *
 * Runs on ordinary PHP hosting (PHP 7.4 or newer with SQLite). Everything it stores lives in the
 * data/ folder next to this file: the settings file and one SQLite database. That folder is closed
 * to visitors, and its file names are random, so nothing in it can be fetched from a browser.
 */
declare(strict_types=1);

if (basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === 'lib.php') {
    http_response_code(404);
    exit;
}

const CODE_LIFE = 600;          // a sign-in code works for 10 minutes
const CODE_TRIES = 5;           // wrong guesses allowed per code
const RESEND_WAIT = 60;         // seconds before the same number can ask again
const CODES_PER_HOUR = 5;       // per phone number
const REQUESTS_PER_HOUR = 120;  // code requests per internet address
const VERIFIES_PER_HOUR = 300;  // code checks per internet address
const DEFAULT_LIMIT = 10;       // free documents, and free cash book entries
const PASSWORD_MIN = 6;         // shortest password an account may have
const PASSWORD_FAILS = 10;      // wrong passwords per number per hour before it is locked for the hour
const FRESH_CODE_SIGN_IN = 1800; // after signing in with a code, a new password may be set without the old one for 30 minutes

function data_dir(): string
{
    $custom = getenv('BILLKUL_DATA');
    return $custom ? rtrim($custom, '/') : __DIR__ . '/data';
}

/** Creates the data folder and closes it to visitors. */
function ensure_data_dir(): void
{
    $dir = data_dir();
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    if (!is_file("$dir/.htaccess")) {
        file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n");
    }
    if (!is_file("$dir/index.php")) {
        file_put_contents("$dir/index.php", "<?php http_response_code(404);\n");
    }
}

/** The server's own settings: its secret key, the database file name and the admin password hash. */
function config(): ?array
{
    static $config = false;
    if ($config === false) {
        $file = data_dir() . '/config.php';
        $config = is_file($file) ? (include $file) : null;
    }
    return is_array($config) ? $config : null;
}

function save_config(array $config): void
{
    ensure_data_dir();
    $file = data_dir() . '/config.php';
    file_put_contents($file, "<?php\nreturn " . var_export($config, true) . ";\n", LOCK_EX);
    @chmod($file, 0600);
    if (function_exists('opcache_invalidate')) {
        @opcache_invalidate($file, true);
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $config = config();
        if (!$config) {
            throw new RuntimeException('not set up');
        }
        $pdo = new PDO('sqlite:' . data_dir() . '/' . $config['db_file']);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA busy_timeout = 5000');
        $pdo->exec('PRAGMA foreign_keys = ON');
        // Deleted rows are wiped, not just unlinked, so a deleted account leaves no number behind in the file.
        $pdo->exec('PRAGMA secure_delete = ON');
        migrate($pdo);
    }
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $version = (int) $pdo->query('PRAGMA user_version')->fetchColumn();
    if ($version < 1) {
        $pdo->exec('CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL UNIQUE,
            plan TEXT NOT NULL DEFAULT \'free\',
            pro_until INTEGER,
            docs_used INTEGER NOT NULL DEFAULT 0,
            cash_used INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            seen_at INTEGER NOT NULL,
            app_version TEXT NOT NULL DEFAULT \'\',
            platform TEXT NOT NULL DEFAULT \'\',
            note TEXT NOT NULL DEFAULT \'\'
        )');
        $pdo->exec('CREATE TABLE IF NOT EXISTS tokens (
            hash TEXT PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            created_at INTEGER NOT NULL,
            seen_at INTEGER NOT NULL,
            device TEXT NOT NULL DEFAULT \'\'
        )');
        $pdo->exec('CREATE TABLE IF NOT EXISTS codes (
            phone TEXT PRIMARY KEY,
            code_hash TEXT NOT NULL,
            code_plain TEXT,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0
        )');
        $pdo->exec('CREATE TABLE IF NOT EXISTS throttle (name TEXT NOT NULL, at INTEGER NOT NULL)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS throttle_name ON throttle (name, at)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS test_numbers (phone TEXT PRIMARY KEY, code TEXT NOT NULL, note TEXT NOT NULL DEFAULT \'\')');
        $pdo->exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
        $pdo->exec('PRAGMA user_version = 1');
    }
    if ($version < 2) {
        // What is left of a deleted account: no number, only a one-way fingerprint of it and the free
        // allowance it had used, so deleting an account and signing up again does not start a new allowance.
        $pdo->exec('CREATE TABLE IF NOT EXISTS used_allowance (phone_hash TEXT PRIMARY KEY, docs_used INTEGER NOT NULL, cash_used INTEGER NOT NULL, deleted_at INTEGER NOT NULL)');
        $pdo->exec('PRAGMA user_version = 2');
    }
    if ($version < 3) {
        // Passwords: a number can sign in with its password, or with a code on WhatsApp when it has none or forgot it.
        $pdo->exec('ALTER TABLE accounts ADD COLUMN password_hash TEXT');
        $pdo->exec("ALTER TABLE tokens ADD COLUMN via TEXT NOT NULL DEFAULT 'code'");
        $pdo->exec('PRAGMA user_version = 3');
    }
    if ($version < 4) {
        // The free allowance a phone has used, under any number: signing in with another number on the
        // same phone carries on from it. Only a one-way fingerprint of the phone's app ID is kept.
        $pdo->exec('CREATE TABLE IF NOT EXISTS device_usage (device_hash TEXT PRIMARY KEY, docs_used INTEGER NOT NULL, cash_used INTEGER NOT NULL, seen_at INTEGER NOT NULL)');
        $pdo->exec('PRAGMA user_version = 4');
    }
}

function setting(string $name, string $default = ''): string
{
    $q = db()->prepare('SELECT value FROM settings WHERE name = ?');
    $q->execute([$name]);
    $value = $q->fetchColumn();
    return $value === false ? $default : (string) $value;
}

function set_setting(string $name, string $value): void
{
    db()->prepare('INSERT OR REPLACE INTO settings (name, value) VALUES (?, ?)')->execute([$name, $value]);
}

function free_limits(): array
{
    return [
        'docs' => max(0, (int) setting('limit_docs', (string) DEFAULT_LIMIT)),
        'cash' => max(0, (int) setting('limit_cash', (string) DEFAULT_LIMIT)),
    ];
}

/**
 * A phone number in international form, "+923001234567", or null when it cannot be a mobile number.
 * Pakistani numbers may be typed the local way: 0300 1234567 or 300 1234567.
 */
function normalize_phone(string $raw): ?string
{
    $raw = trim($raw);
    $plus = strncmp($raw, '+', 1) === 0;
    $digits = preg_replace('/\D+/', '', $raw);
    if ($digits === null || $digits === '') {
        return null;
    }
    if (!$plus && strncmp($digits, '00', 2) === 0) {
        $digits = substr($digits, 2);
        $plus = true;
    }
    if (!$plus) {
        if (preg_match('/^03\d{9}$/', $digits)) {
            $digits = '92' . substr($digits, 1);
        } elseif (preg_match('/^3\d{9}$/', $digits)) {
            $digits = '92' . $digits;
        } elseif (!preg_match('/^92\d+$/', $digits)) {
            return null;
        }
    }
    if (strncmp($digits, '92', 2) === 0) {
        return preg_match('/^923\d{9}$/', $digits) ? '+' . $digits : null;
    }
    return preg_match('/^[1-9]\d{7,14}$/', $digits) ? '+' . $digits : null;
}

function client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 64);
}

/** Counts one more use of something and says whether it is still within its hourly (or other) allowance. */
function allow(string $name, int $max, int $window): bool
{
    $pdo = db();
    $since = time() - $window;
    $q = $pdo->prepare('SELECT COUNT(*) FROM throttle WHERE name = ? AND at > ?');
    $q->execute([$name, $since]);
    if ((int) $q->fetchColumn() >= $max) {
        return false;
    }
    $pdo->prepare('INSERT INTO throttle (name, at) VALUES (?, ?)')->execute([$name, time()]);
    if (random_int(1, 50) === 1) {
        $pdo->prepare('DELETE FROM throttle WHERE at < ?')->execute([time() - 86400]);
        $pdo->prepare('DELETE FROM codes WHERE expires_at < ?')->execute([time() - 3600]);
    }
    return true;
}

function code_hash(string $phone, string $code): string
{
    $config = config();
    return hash_hmac('sha256', $phone . ':' . $code, (string) $config['secret']);
}

/** A one-way fingerprint of a phone number, for remembering used allowance after an account is deleted. */
function phone_hash(string $phone): string
{
    $config = config();
    return hash_hmac('sha256', 'allowance:' . $phone, (string) $config['secret']);
}

/** A one-way fingerprint of the ID the app sends for its phone, or null when it sent none. */
function device_hash(string $device): ?string
{
    if (!preg_match('/^[A-Za-z0-9_-]{8,128}$/', $device)) {
        return null;
    }
    $config = config();
    return hash_hmac('sha256', 'device:' . $device, (string) $config['secret']);
}

/**
 * Brings an account and the phone it is used on to the same counts, the larger of the two, and
 * returns the account as it now is. A new number on a phone that used up its allowance starts full.
 */
function share_device_usage(array $account, ?string $device): array
{
    if ($device === null) {
        return $account;
    }
    $pdo = db();
    $q = $pdo->prepare('SELECT docs_used, cash_used FROM device_usage WHERE device_hash = ?');
    $q->execute([$device]);
    $row = $q->fetch() ?: ['docs_used' => 0, 'cash_used' => 0];
    $docs = max((int) $account['docs_used'], (int) $row['docs_used']);
    $cash = max((int) $account['cash_used'], (int) $row['cash_used']);
    $pdo->prepare('INSERT OR REPLACE INTO device_usage (device_hash, docs_used, cash_used, seen_at) VALUES (?, ?, ?, ?)')
        ->execute([$device, $docs, $cash, time()]);
    if ($docs !== (int) $account['docs_used'] || $cash !== (int) $account['cash_used']) {
        $pdo->prepare('UPDATE accounts SET docs_used = ?, cash_used = ? WHERE id = ?')->execute([$docs, $cash, $account['id']]);
        $account['docs_used'] = $docs;
        $account['cash_used'] = $cash;
    }
    return $account;
}

function is_pro(array $account): bool
{
    return $account['plan'] === 'pro' && ($account['pro_until'] === null || (int) $account['pro_until'] >= time());
}

/** What the app is told about an account. */
function account_view(array $account): array
{
    $pro = is_pro($account);
    return [
        'phone' => $account['phone'],
        'plan' => $pro ? 'pro' : 'free',
        'proUntil' => $pro && $account['pro_until'] !== null ? gmdate('Y-m-d', (int) $account['pro_until']) : '',
        'docsUsed' => (int) $account['docs_used'],
        'cashUsed' => (int) $account['cash_used'],
        'limits' => free_limits(),
        'supportWhatsapp' => setting('support_whatsapp'),
        'googleClientId' => setting('google_client_id'),
        'hasPassword' => (string) ($account['password_hash'] ?? '') !== '',
    ];
}

function find_account(string $phone): ?array
{
    $q = db()->prepare('SELECT * FROM accounts WHERE phone = ?');
    $q->execute([$phone]);
    $row = $q->fetch();
    return $row ?: null;
}

/** Starts a sign-in on a device. `via` is how it was proved: 'code' or 'password'. */
function issue_token(array $account, string $device, string $via): string
{
    $token = bin2hex(random_bytes(32));
    $now = time();
    db()->prepare('INSERT INTO tokens (hash, account_id, created_at, seen_at, device, via) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([hash('sha256', $token), $account['id'], $now, $now, $device, $via]);
    db()->prepare('UPDATE accounts SET seen_at = ? WHERE id = ?')->execute([$now, $account['id']]);
    return $token;
}

/** How often something happened recently, without counting this time. */
function recent(string $name, int $window): int
{
    $q = db()->prepare('SELECT COUNT(*) FROM throttle WHERE name = ? AND at > ?');
    $q->execute([$name, time() - $window]);
    return (int) $q->fetchColumn();
}

function remember(string $name): void
{
    db()->prepare('INSERT INTO throttle (name, at) VALUES (?, ?)')->execute([$name, time()]);
}

function account_by_token(string $token): ?array
{
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        return null;
    }
    $hash = hash('sha256', $token);
    $q = db()->prepare('SELECT a.*, t.via AS token_via, t.created_at AS token_at, t.hash AS token_hash FROM tokens t JOIN accounts a ON a.id = t.account_id WHERE t.hash = ?');
    $q->execute([$hash]);
    $row = $q->fetch();
    if (!$row) {
        return null;
    }
    db()->prepare('UPDATE tokens SET seen_at = ? WHERE hash = ?')->execute([time(), $hash]);
    return $row;
}
