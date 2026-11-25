-- Cupo diario por cuenta SMTP de la rotación de verificación.
-- Tabla interna: sin gym_id y sin políticas, solo accesible por la API (postgres/service_role).

CREATE TABLE IF NOT EXISTS public.email_send_quotas (
  account    text        NOT NULL,
  day        date        NOT NULL,
  sent_count integer     NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account, day)
);

ALTER TABLE public.email_send_quotas ENABLE ROW LEVEL SECURITY;
