# Riyadh grocery comparison evaluation

Page: `/grocery-test.html`, linked from More. Release 4.28.

The initial page supports a manual shopping list, local receipt preview, reviewed manual price entry, product search/confirmation and Riyadh branch price comparison. It does not write finance data, save receipts, send receipts to providers or claim OCR. Lists are memory-only; reload clears them.

## Provider connection

Use the official Muwazin evaluation program: https://muwazin.me/en/data/
Documentation: https://muwazin.me/developers/docs/

Request a key for private evaluation of a Riyadh personal shopping-list comparison. The account holder must review and accept the provider's current terms in its console. This implementation never accepts terms automatically. An evaluation key is not a commercial publication licence.

Configure the following server-side Vercel environment variables, then redeploy:

- `MUWAZIN_API_KEY`: provider key, never exposed to browser code.
- `GROCERY_TEST_USER_IDS`: comma-separated Supabase Auth user UUIDs allowed to test. Use Auth user IDs, not workspace IDs. Empty means denied.

No secret values are committed. The existing publishable Supabase key is used solely to verify bearer tokens with `/auth/v1/user`; no service role or financial tables are used. No test data is seeded into user workspaces.

POST `/api/grocery?action=status`: returns configuration state. Configured does not mean the provider key has been verified.
POST `/api/grocery?action=search&q=...`: searches up to ten products for review.
POST `/api/grocery?action=search&barcode=...`: barcode lookup.
POST `/api/grocery?action=branches&id=...`: Riyadh, in-stock branch offers, up to 500 returned rows per page, with bounded opaque cursor forwarding. The browser follows at most 20 pages, checks for repeated cursors, then compares eligible offers by ascending price without location/distance inputs. Partial coverage is labelled; no complete-market claim is made.

The browser sends the Supabase access token in a JSON body (`accessToken`), never in the URL. This supports sessions containing profile metadata larger than 8 KB without exceeding HTTP header limits. Requests are capped at 128 KB and tokens at 96 KB. The server still validates every session through Supabase and requires the exact administrator UUID/email plus tester allowlisting. Legacy GET requests with a bearer header remain supported.

All paid-provider calls require a verified Supabase session and explicit tester allowlisting. Methods, queries and identifiers are bounded. Provider URL is fixed, keys stay server-side, raw upstream errors are not exposed and errors are not converted into fake prices. Usage is bounded per request; production-wide abuse/quota controls must be added before broad rollout.

Prices are displayed only after product confirmation. Same price basis (item/kg), numeric positive SAR price, in stock, not stale, latest branch confirmation (`branchLastSeen`, falling back to `updatedAt`) within 48 hours and Riyadh city are required. The date of a price change is preserved separately from the latest branch confirmation, so an unchanged price checked today is not incorrectly rejected as old. Empty results explain why prices are unavailable; search results are ranked by product-name terms and still require exact brand/size review. Detected single-item/multipack differences require explicit whole-pack confirmation before fetching prices. Positive savings carry a + sign; a higher comparison cost is labelled as extra cost rather than presented as savings. Manual prices are separately labelled. Complete single-store recommendations are grouped by branch, never by retailer across incompatible branches. Partial savings compare only matched rows. Extra cost is applied once per store visited/delivery.

The evaluation key is configured server-side; provider access was tested separately. End-to-end verification with the administrator’s browser remains pending.

Still pending: receipt OCR, durable workspace-isolated shopping lists, location/distance routing, production rollout.


## 4.34 private grocery organizer

Adds editable receipt drafts, optional on-device Tesseract.js 5.1.1 reading (English/Arabic, language files downloaded on demand), shop-scoped approved product aliases, private receipt history, reusable usual groceries, and a per-branch split checklist. Receipt images remain browser-local. OCR output is never imported until individual lines are approved. The initial generic receipt parser is intentionally conservative; real receipt samples are needed to tune shop formats. Summary/discount/unclear lines remain available for manual review. Exact repeated receipt text/shop/date is prevented from adding twice.

`finance_grocery_state` is separate from finance records and protected with admin/user RLS. The payload is scoped by user and owned workspace; optimistic revision checks reject conflicting device writes. User/workspace-scoped browser drafts retain pending edits, with recovery copies when cloud state has advanced. Apply `grocery-storage.sql` once before deployment.

Compare shopping list refreshes confirmed products and searches suggestions for unmatched items sequentially. It requests confirmation before paid-provider calls. Recommendations use matching units, in-stock, fresh Riyadh offers, lowest unit price, and one assignment per item. Price ties prefer an already-used branch then stable branch key. Shop exclusions and per-item unavailable actions recalculate the recommendation. Extra visit costs are shown after choosing each item's lowest price; this is not route or fixed-cost optimization. Checklists do not record bank transactions. Cross-device content is read on load; concurrent updates are rejected rather than silently overwritten.

Validation: browser fixture checks reviewed receipt imports, 10+5 split, confirmation, filters, saved checklists/exclusions, reload, workspace isolation, approved aliases, usual-item reuse, mobile overflow, OCR draft flow with a mocked OCR result, and concurrent-write protection. Actual photo-recognition accuracy and live signed-in provider calls remain for user testing.
