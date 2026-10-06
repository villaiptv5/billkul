# BillKul app: notes for anyone (or any AI session) working on this code

BillKul is a quotation and invoice maker for small businesses, built with Expo (React Native) for
Android first and iPhone second. The product plan and decisions live one folder up, in
`BillKul-Product-Plan.md` and `BillKul-Project-Notes.md`. Read those before changing behaviour.

## Expo changes between versions

Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS or
React Native API, read the `expo` major version in `package.json` and check the matching docs at
`https://docs.expo.dev/versions/v<major>.0.0/`. Do not answer from memory.

## Commands

```bash
npm test                 # logic, store and document template tests (vitest)
npm run typecheck        # tsc --noEmit
npm run build:web        # web build, then refreshes pc-preview/site
npx expo install <pkg>   # always use this to add packages, so versions match the SDK
```

Run the tests and the type check before calling any change done. Where the machine has no access to
api.expo.dev, set `EXPO_OFFLINE=1` for expo commands.

## Decisions that differ from the Expo template

- **React Navigation, not Expo Router.** Navigation holds no URLs, so the web build runs from any
  folder or address (the PC preview depends on this). Screens are registered in `App.tsx`.
- **One storage path on every platform.** `index.ts` imports `expo-sqlite/localStorage/install`,
  which backs `localStorage` with SQLite on the phone; in a browser it is the browser's own storage.
  All reads and writes go through `src/data/store.ts`. Every change is saved at once (autosave).
- **Phone and browser versions of a file.** `Name.tsx` is the phone version and `Name.web.tsx` the
  browser version (see `src/platform`). Keep both in step.
- **Two layouts in the browser.** A window at least 1000 px wide gets the desktop layout
  (`src/desktop`: sidebar, tables, editor with a live preview beside it). Narrower windows, and the
  phone app, get the phone layout (`src/screens`). The widths are in `src/ui/layout.ts`. The desktop
  layout has its own small router (`src/desktop/route.ts`) that mirrors the page in the address
  after `#`, so Back, Forward and Reload work without the server knowing any paths. Logic shared by
  both layouts lives in hooks (`useDocEditor`, `useBackupActions`), not in the screens.
- **The books are read from the documents, not copied from them.** A paid invoice appears in the
  cash book, an issued invoice takes stock, and stock bought with a cost appears as an expense, all
  worked out on the fly in `src/logic/ledger.ts` and `src/logic/stock.ts`. Nothing is stored twice,
  so editing or deleting an invoice can never leave the cash book or the stock count out of step.
  Only what is typed by hand is stored: cash entries and stock put in or corrected.
- **Purchase price and profit.** An item has a sale price (`price`) and a purchase price (`cost`).
  A line copies the purchase price when it is added (`DocLine.cost`), so later price changes do not
  rewrite past profit. `src/logic/sales.ts` works the sales report out from issued invoices, for a
  day or a month; the purchase price is never printed or shown to the customer.
- **Android folders are generated.** Never create or edit `android/` or `ios/` by hand. Configure
  native behaviour in `app.json`.

## Layout of the code

- `src/logic` — money, totals, dates, monthly figures. No React. Fully tested.
- `src/data` — types, the store (documents, customers, items, settings, backup), sample items.
- `src/pdf/template.ts` — the quote/invoice page as HTML. Preview, print, PDF and image all use it.
- `src/i18n` — English and Urdu text. Every string on screen comes from here.
- `src/ui` — shared components. `T` picks the typeface from the words (Latin or Urdu script).
- `src/screens` — the phone layout, one file per screen. `src/desktop` — the desktop layout, one
  file per page. `src/platform` — sharing, files, logo, contacts, preview.
- `pc-preview` — the browser copy for testing on a PC, and the script that serves it.

## Rules of the product

- Urdu is right-to-left. Use `paddingStart`/`marginEnd` style props, never left/right, and let rows
  flip on their own. Amounts and document numbers always use the `latin` prop.
- A user's data is never lost or locked: autosave on every edit, backup and restore stay free.
- Documents are quotations and bills, not FBR tax invoices.
- Not yet verified on a real phone: PDF sharing, image sharing, contact picking and Urdu text in
  printed PDFs. Treat these as untested until someone runs the Android build.
