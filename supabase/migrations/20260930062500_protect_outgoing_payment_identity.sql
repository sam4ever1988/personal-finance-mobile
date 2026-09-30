LOCK TABLE public.finance_user_records IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM public.finance_user_records
  WHERE section='cash_flow_ledger' AND deleted_at IS NULL
    AND data->>'referenceId' LIKE 'outgoing:outpay-%'
  GROUP BY user_id,data->>'referenceId'
  HAVING count(DISTINCT (data-'id'))>1
 ) THEN RAISE EXCEPTION 'Different versions of a payment require review before deduplication'; END IF;
END $$;
WITH copies AS (
 SELECT user_id,section,record_id,
 row_number() OVER (PARTITION BY user_id,data->>'referenceId',data-'id' ORDER BY record_id) AS copy_number
 FROM public.finance_user_records
 WHERE section='cash_flow_ledger' AND deleted_at IS NULL
 AND data->>'referenceId' LIKE 'outgoing:outpay-%'
)
UPDATE public.finance_user_records r SET deleted_at=now()
FROM copies c WHERE c.copy_number>1 AND r.user_id=c.user_id AND r.section=c.section AND r.record_id=c.record_id;
CREATE UNIQUE INDEX IF NOT EXISTS finance_one_outgoing_payment_reference
 ON public.finance_user_records (user_id,(data->>'referenceId'))
 WHERE section='cash_flow_ledger' AND deleted_at IS NULL AND data->>'referenceId' LIKE 'outgoing:outpay-%';