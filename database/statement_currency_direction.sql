create or replace function public.finance_template_mapping_valid(config jsonb) returns boolean language sql immutable set search_path='' as $function$
 select jsonb_typeof(config)='object'
 and config ?& array['date','description','headerRow','dataStartRow']
 and (config->>'date') ~ '^[A-Z]{1,3}$' and (config->>'description') ~ '^[A-Z]{1,3}$'
 and ((config->>'amount') ~ '^[A-Z]{1,3}$' or (config->>'debit') ~ '^[A-Z]{1,3}$' or (config->>'credit') ~ '^[A-Z]{1,3}$')
 and not exists(select 1 from jsonb_each(config) p where case
 when p.key in ('headerRow','dataStartRow') then not(jsonb_typeof(p.value)='number' and p.value::text ~ '^[1-9][0-9]{0,5}$')
 when p.key in ('date','description','amount','debit','credit','balance','reference','cardLast4','direction','currency','counterparty') then not(jsonb_typeof(p.value)='string' and (p.value #>> '{}') ~ '^([A-Z]{1,3})?$')
 when p.key='sourceCurrency' then not(jsonb_typeof(p.value)='string' and (p.value #>> '{}') ~ '^(PHP|SAR)?$')
 else true end);
$function$;