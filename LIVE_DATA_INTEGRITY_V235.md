# V235 Live Data Integrity Safeguards

Do not mutate or delete live finance data solely because two records look similar.

## Required identity rules

### Card payment ledger
Primary identity: durable ledger `id` / `referenceId`.
Fallback for legacy rows only: target card + target payment month + payment date + amount + funding source.

A duplicate detected by the fallback must be quarantined/reported before deletion unless the rows are byte-for-byte equivalent financial events.

### Statement/payment planner
Official imported statements and date-driven calculated cycles are separate calculation paths.

Official statement:
`original statement - installment conversions - recorded payments = remaining`.

Date-driven cycle:
`eligible cycle transactions + monthly installment commitments - recorded payments = remaining`.

Never apply `installmentTransferAdjustments` to a date-driven/auto-generated planner row.

### Cross-device restore
Restore/merge must be idempotent. Reopening the same cloud snapshot on another device must not:
- create a second ledger payment;
- recreate a payment-history item;
- reapply an installment conversion;
- convert a calculated cycle into a released statement;
- overwrite newer live state with an older snapshot.

## Safety requirements
- Save a recovery snapshot before any automatic repair/migration.
- Prefer merge-by-stable-ID over array concatenation.
- Preserve `paymentHistory`, `cashFlowLedger`, imported statements and installment links.
- Automatic cleanup must be repeatable: running it twice produces the same state as running it once.
- Dashboard and Payment Planner must consume the same canonical calculations.

## Known office-PC symptom (September 2026)
Two meem / GIB Saudi Visa Platinum •7102 ledger rows appeared for 2026-09-07 at SAR 845.00 funded from Monthly Planned Income. Treat this as evidence of a sync/merge duplicate, but do not hard-code this specific amount/card into production cleanup logic.
