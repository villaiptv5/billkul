# BillKul

Quotation and invoice maker for small businesses. Android first, iPhone second, one codebase (Expo / React Native).

## Try it on a PC

Double-click **Open BillKul on PC.bat** in the folder above this one. A small window opens, then the
app appears in your browser at http://localhost:8765/. Keep the window open while testing.

What you type is kept in the browser between runs. To start fresh, open Settings in the browser and
clear the site data for localhost:8765.

The browser copy behaves like the phone app except for three things that need a phone:
sending the PDF or picture as a file, importing from phone contacts, and the phone's own backup.

## Work on the code

Needs Node.js 20 or newer.

```bash
npm install
npm test            # 31 checks on totals, numbering, autosave, backup, documents
npm run typecheck
npm run web         # live preview while editing
npm run build:web   # rebuilds the PC preview in pc-preview/site
```

## Version 1 contents

Setup, Home, New quote or invoice, Preview and send, Documents, Customers, Items, Settings.
English and Urdu. Works offline with autosave. Backup to a file and restore from it.

Not in this build yet: automatic Google Drive backup (needs a Google sign-in setup),
and the Android build itself.
