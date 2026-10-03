# Riyadh grocery comparison evaluation

Page: `/grocery-test.html`, linked from More. Release 4.03.

The initial page supports a manual shopping list, local receipt preview, reviewed manual price entry, product search/confirmation and Riyadh branch price comparison. It does not write finance data, save receipts, send receipts to providers or claim OCR. Lists are memory-only; reload clears them.

## Provider connection

Use the official Muwazin evaluation program: https://muwazin.me/en/data/
Documentation: https://muwazin.me/developers/docs/

Request a key for private evaluation of a Riyadh personal shopping-list comparison. The account holder must review and accept the provider's current terms in its console. This implementation never accepts terms automatically. An evaluation key is not a commercial publication licence.

Configure the following server-side Vercel environment variables, then redeploy:

- `MUWAZIN_API_KEY`: provider key, never exposed to browser code.
- `GROCERY_TEST_USER_IDS`: comma-separated Supabase Auth user UUIDs allowed to test. Use Auth user IDs, not workspace IDs. Empty means denied.

No secret values are committed. The existing publishable Supabase key is used solely to verify bearer tokens with `/auth/v1/user`; no service role or financial tables are used. No test data is seeded into user workspaces.

GET `/api/grocery?action=status`: returns configuration state. Configured does not mean the provider key has been verified.
GET `/api/grocery?action=search&q=...`: searches up to ten products for review.
GET `/api/grocery?action=search&barcode=...`: barcode lookup.
GET `/api/grocery?action=branches&id=...`: Riyadh, in-stock branch offers, up to 200 returned rows. Partial pages are labelled; no complete-market claim is made.

All paid-provider calls require a verified Supabase session and explicit tester allowlisting. Methods, queries and identifiers are bounded. Provider URL is fixed, keys stay server-side, raw upstream errors are not exposed and errors are not converted into fake prices. Usage is bounded per request; production-wide abuse/quota controls must be added before broad rollout.

Prices are displayed only after product confirmation. Same price basis (item/kg), numeric positive SAR price, in stock, not stale, valid timestamp within 48 hours and Riyadh city are required. Manual prices are separately labelled. Complete single-store recommendations are grouped by branch, never by retailer across incompatible branches. Partial savings compare only matched rows. Extra cost is applied once per store visited/delivery.

Still pending: provider access, real-key contract/coverage testing, receipt OCR, durable workspace-isolated shopping lists, location/distance routing, full pagination and production rollout.
