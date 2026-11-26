CREATE TABLE IF NOT EXISTS public.receipt_counters (
  gym_id uuid NOT NULL REFERENCES public.gyms (id) ON DELETE CASCADE,
  receipt_year integer NOT NULL CHECK (receipt_year BETWEEN 2000 AND 9999),
  last_value bigint NOT NULL CHECK (last_value > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gym_id, receipt_year)
);

INSERT INTO public.receipt_counters (gym_id, receipt_year, last_value)
SELECT
  gym_id,
  substring(receipt_number FROM '^LUD-([0-9]{4})-[0-9]+$')::integer,
  max(substring(receipt_number FROM '^LUD-[0-9]{4}-([0-9]+)$')::bigint)
FROM public.payments
WHERE receipt_number ~ '^LUD-[0-9]{4}-[0-9]+$'
GROUP BY gym_id, substring(receipt_number FROM '^LUD-([0-9]{4})-[0-9]+$')
ON CONFLICT (gym_id, receipt_year) DO UPDATE
SET last_value = GREATEST(public.receipt_counters.last_value, EXCLUDED.last_value),
    updated_at = now();

ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.receipt_counters;
CREATE POLICY tenant_isolation ON public.receipt_counters
  USING (gym_id = public.current_gym_id())
  WITH CHECK (gym_id = public.current_gym_id());
