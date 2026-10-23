# Mart360

Mart360 is a deployable store operations app for Indian grocery and superstores. It provides owner sign-in, private shop workspaces, billing, stock, suppliers, purchase orders, expenses, payroll records, and reports.

## Run the local demo

Open `index.html` in a modern browser and choose **Try the demo**. It opens a populated sample store with recent bills, sales charts, suppliers, purchase orders, expenses, and staff. Demo edits save only in that browser’s local storage so they survive reloads and exits; they are never sent to Supabase. Use **Reset demo to sample data** to undo demo edits and restore the original sample store. Downloads, backups, and restore are disabled in demo mode. The 72-hour timer starts on first use and then erases the browser’s demo workspaces and requires an invited owner account to continue. This browser-only limit is best-effort: clearing site data or using another browser/device can start a fresh timer. A non-bypassable trial needs verified identity and server-side expiry.

## Install Mart360 like an app

Deploy the folder to an HTTPS site first. Open that site in Chrome or Edge and choose **Install Mart360** on the sign-in screen. The app shell and brand assets are cached so the app can open while offline; owner sign-in and cloud saving still need an internet connection. You can also use the browser menu's install option.

## Enable real accounts and cloud sync

1. Create or select a Supabase project in the region you want to use for store data.
2. Run `schema.sql` in that project's SQL editor. If you already ran the earlier version of this file, run `schema-upgrade.sql` instead.
3. Copy `config.example.js` to `config.js` and fill in the project's URL and publishable key. A publishable key is intended for browser use; never put a secret or service-role key in this file.
4. Deploy the folder as a static site. Set the deployed URL as the Supabase Auth Site URL and add it to the allowed redirect URLs.
5. In Supabase Authentication settings, turn off **Allow new users to sign up**. Then invite each approved owner from **Authentication → Users → Add user → Send invitation**. Existing accounts are not removed by disabling signups; ban any account you do not approve. Approved owners sign in and create their own workspace.

Only invited/approved owners should receive accounts. Each authenticated owner can access only workspaces whose `owner_id` matches their own Supabase user ID. Row Level Security protects the entire workspace row, including payroll and ledger data. One row stores one shop's complete state as JSON so a bill and its stock deduction save together. Signed-in devices subscribe to Supabase Realtime and refresh when another device saves the same workspace. A revision counter detects simultaneous edits instead of silently overwriting newer data. If you already ran the previous SQL files, run the updated `schema-upgrade.sql` once to enable Realtime for the workspace table. Demo mode does not sync between devices. Use the in-app **Backup** button to download a copy, and **Restore** to load it later.

## Owner backups and data controls

- **Download all-store backup** saves every store in one JSON file. **Restore backup** adds new copies and does not overwrite existing stores. You can use the workspace picker to restore after signing into a new account.
- **Clear all store data** downloads a backup first, then requires typing `CLEAR`. It empties products, bills, suppliers, purchase orders, owner books, team/payroll, and receipt details while keeping the current store and owner login.
- **Delete this store** downloads a backup first and requires the exact store name. It removes only the selected workspace. The owner login and other stores remain.
- **Cancel** on a bill keeps the bill marked as cancelled, restores the sold quantities where those products still exist, and records a sale reversal. Cancelled bills are excluded from sales totals and cannot be reprinted.
- **Delete owner account** requires an all-store backup and typing the signed-in email. It permanently removes that Auth user and, through the existing `owner_id ... on delete cascade` relationship, every workspace they own.

### Turn on store and account deletion

Both delete actions use the included server-side function so the Supabase service-role key never appears in `config.js` or the website. In the Supabase Dashboard, open **Edge Functions → Deploy a new function → Via Editor**, name it `owner-data-actions`, replace the template with `supabase/functions/owner-data-actions/index.ts`, and deploy with JWT verification enabled. The function verifies the signed-in user; store deletion also filters by that user's owner ID. Account deletion removes only the signed-in user and their owned workspaces. Supabase's Auth admin delete API requires a server-side service-role key: [Supabase deleteUser reference](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).

No new table or SQL change is needed for these controls.

## Store workflows

- Overview: inventory value, low-stock alerts, recent sales, and sales mix.
- Inventory: add/edit products, stock counts, reorder point, cost, selling price, GST, category, and barcode/SKU lookup.
- Sell: scan with a USB/Bluetooth keyboard barcode scanner, search products, adjust cart quantities, take UPI/cash/card/credit payment, and print a receipt.
- Sales & bills: search saved sales by bill number, date, payment type or product, then reprint receipts.
- Purchases: supplier list and purchase orders; receive orders into stock.
- Owner books: record expenses and salary payments.
- Team: keep staff and salary records for the owner.
- Reports: sales and stock summaries.
- Store settings: save your shop name, address, phone, optional GSTIN, and receipt message. The details are stored with the workspace and appear on printed bills.
- Store settings: download or restore backups, clear a store, delete a store, or securely delete an owner account.

This package is a first deployable version, not a certified accounting, GST filing, payroll compliance, or payment-processing service. Review tax calculations and operational controls before using it for statutory books.
