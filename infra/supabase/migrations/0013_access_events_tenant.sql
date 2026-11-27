-- El dedupe actual (member_id, qr_bucket, result) ignora el gimnasio, por lo
-- que un mismo socio en dos gimnasios no puede registrar eventos en el mismo
-- bucket. Se sustituye por un índice único por tenant.

ALTER TABLE public.access_events DROP CONSTRAINT IF EXISTS access_event_dedupe;

CREATE UNIQUE INDEX IF NOT EXISTS ux_access_event_dedupe_tenant
  ON public.access_events (gym_id, member_id, qr_bucket, result);
