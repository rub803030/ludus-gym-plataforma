-- Datos iniciales de Ludus GYM. Solo desarrollo / staging.
INSERT INTO gyms (id, name, slug, capacity)
VALUES ('00000000-0000-7000-8000-000000000001', 'Ludus GYM', 'ludus-gym', 80)
ON CONFLICT (id) DO NOTHING;

INSERT INTO plans (id, gym_id, name, description, duration_days, price_cents, includes_classes, includes_nutrition)
VALUES
  ('00000000-0000-7000-8000-000000000010', '00000000-0000-7000-8000-000000000001', 'Mensual', 'Acceso libre a sala', 30, 69900, false, false),
  ('00000000-0000-7000-8000-000000000011', '00000000-0000-7000-8000-000000000001', 'Mensual Plus', 'Sala + clases Hyrox', 30, 99900, true, false),
  ('00000000-0000-7000-8000-000000000012', '00000000-0000-7000-8000-000000000001', 'Trimestral Pro', 'Sala + clases + nutrición', 90, 249900, true, true)
ON CONFLICT (id) DO NOTHING;
