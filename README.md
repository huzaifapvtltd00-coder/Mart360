# Mart360

Mart360 is a deployable store operations app for Indian grocery and superstores. It provides owner sign-in, private shop workspaces, billing, stock, suppliers, purchase orders, expenses, payroll records, and reports.

## Run the local demo

Open `index.html` in a modern browser and choose **Try the demo**. Demo workspaces are saved on that browser only.

## Enable real accounts and cloud sync

1. Create or select a Supabase project in the region you want to use for store data.
2. Run `schema.sql` in that project's SQL editor. If you already ran the earlier version of this file, run `schema-upgrade.sql` instead.
3. Copy `config.example.js` to `config.js` and fill in the project's URL and publishable key. A publishable key is intended for browser use; never put a secret or service-role key in this file.
4. Deploy the folder as a static site. Set the deployed URL as the Supabase Auth Site URL and add it to the allowed redirect URLs.
5. Sign up with an owner email, create a workspace, and enter real store records.

Each authenticated owner can access only workspaces they own. Row Level Security protects the entire workspace row, including payroll and ledger data. One row stores one shop's complete state as JSON so a bill and its stock deduction save together. A revision counter detects stale saves from another tab/device instead of silently overwriting newer data. Demo mode does not sync between devices. Use the in-app **Backup** button to download a copy, and **Restore** to load it later.

## Store workflows

- Overview: inventory value, low-stock alerts, recent sales, and sales mix.
- Inventory: add/edit products, stock counts, reorder point, cost, selling price, GST, category, and barcode/SKU lookup.
- Sell: scan with a USB/Bluetooth keyboard barcode scanner, search products, adjust cart quantities, take UPI/cash/card/credit payment, and print a receipt.
- Purchases: supplier list and purchase orders; receive orders into stock.
- Owner books: record expenses and salary payments.
- Team: keep staff and salary records for the owner.
- Reports: sales and stock summaries.

This package is a first deployable version, not a certified accounting, GST filing, payroll compliance, or payment-processing service. Review tax calculations and operational controls before using it for statutory books.
