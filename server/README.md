# BillKul account server

Sign-in by mobile number, the free allowance, and Pro. Plain PHP (7.4 or newer) with SQLite, made to run
on ordinary web hosting next to the web version.

## What is here

- `api/index.php` is what the app talks to. Routes are a query value (`index.php?r=auth/request`), so the
  hosting needs no rewrite rules.
- `api/admin/` is the owner's page: codes waiting to be sent, accounts and Pro, test numbers, settings.
- `api/lib.php` is shared code. `api/data/` appears on the hosting the first time the server runs and
  holds the settings file and the database. It is closed to visitors and its file names are random.
- `tests/run.php` plays the app and the owner against a temporary server: `npm run test:server`.

## Putting it on the hosting

`npm run build:web` copies `api/` into `pc-preview/site/api/`, so uploading the `site` folder carries the
server with it. The `data` folder is never part of an upload, so uploading again keeps every account.

1. Upload the contents of `pc-preview/site` to the web folder of the site, as before.
2. Open `https://<the site>/api/admin/` straight away and choose the admin password. Whoever opens that page
   first chooses the password, so do not leave it for later.
3. In Settings, enter the WhatsApp number customers should contact for Pro.
4. Once a Google Cloud project exists, enter its Web client ID in Settings. The app then offers automatic
   backup to the user's own Google Drive; until then that offer stays hidden.

Never delete `api/data` on the hosting: it is the list of accounts.

## How codes reach people today

The official WhatsApp sending service is not connected yet. Until it is:

- A code asked for in the app appears on the admin page under "Codes to send", with a button that opens
  the owner's own WhatsApp with the message ready.
- "Test numbers" sign in with a fixed code and are sent nothing. They are for Google's reviewers and for
  trusted testers.

## Rules the server keeps

- A code is 6 digits, works for 10 minutes and for 5 guesses. A number can ask once a minute, 5 times an hour.
- Counts of documents and cash book entries only go up, and survive reinstalling and deleting the account.
- The counts are also kept per phone (a one-way fingerprint of the app's Android ID). Another number signed in on the same phone starts from the phone's count, not from 0.
- A signed-in customer can move the account to a new number (Settings, Change my number), proved with a code sent to the new number. For a customer who lost the old SIM, the admin page has "Move an account to a new number" under Accounts.
- After the first code the app asks for a password (6 characters or more); from then on the number signs in with it, no code. 10 wrong passwords in an hour stop that number for the hour. "Forgot password" sends a code and the app asks for a new password. A new password signs out every other device.
- Sign-in tokens and codes are stored as fingerprints, not as they are. Passwords and the admin password are hashed.
- The app's limits are checked in the app; the server is the record of the plan and of what was used.
