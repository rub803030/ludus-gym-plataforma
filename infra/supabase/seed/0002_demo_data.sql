-- Datos demo de Ludus GYM (SOLO desarrollo).
-- Correos de prueba (requieren verificación):
--   rubnlira2+owner@gmail.com / Owner2026!
--   rubnlira2+manager@gmail.com / Manager2026!
--   rubnlira2+staff@gmail.com / Staff2026!
--   rubnlira2+socio@gmail.com / Ludus2026!

INSERT INTO staff_users (id, gym_id, email, password_hash, full_name, role, is_active) VALUES ('00000000-0000-7000-8000-000000000101', '00000000-0000-7000-8000-000000000001', 'rubnlira2+owner@gmail.com', 'scrypt$fa190ed7bf71c499178977a82d51ca7b$88d8f08dc29aee7b1b1edc44f1bc1a6d9efa4c0d59b4e3e601df737a1483245951fe95cb4406013bfa18bb521593d005139941f5bbbe066e19bc36c32f2e40a5', 'Ricardo Dueño', 'OWNER', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO staff_users (id, gym_id, email, password_hash, full_name, role, is_active) VALUES ('00000000-0000-7000-8000-000000000102', '00000000-0000-7000-8000-000000000001', 'rubnlira2+manager@gmail.com', 'scrypt$f05ad21198f2f4e5c6da0d97a049f584$65e38f358f93caab7813780f03564cc73e561524b6412c63a68afcfe4e8f451d02a835f7f0514e38a695af9e34f4d4efacd389e5d62e3dbf5feb1f1b6d5e97c4', 'Mariana Encargado', 'MANAGER', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO staff_users (id, gym_id, email, password_hash, full_name, role, is_active) VALUES ('00000000-0000-7000-8000-000000000103', '00000000-0000-7000-8000-000000000001', 'rubnlira2+staff@gmail.com', 'scrypt$b8aea7eefe60a05ab6c0f3b29a955f4b$a44ebcac0df7e211bdf398179fcbe8a76378bbb6817cec56131353d1eef24a214d55dd6fc169c009649e1055d7e52df4f85e17bc2d3897f9fac4021940c35358', 'Sofía Recepción', 'STAFF', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO members (id, gym_id, code, first_name, last_name, email, phone, document_type, document_number, birth_date, status, joined_at) VALUES ('00000000-0000-7000-8000-000000000201', '00000000-0000-7000-8000-000000000001', 'LUD-000001', 'Ana', 'Martínez', 'rubnlira2+socio@gmail.com', '+52 55 1234 5678', 'INE', 'MART890123ABC', '1998-03-12', 'ACTIVE', now()) ON CONFLICT (id) DO NOTHING;

-- La columna password_hash se agrega en 0002_member_auth.sql
UPDATE members SET password_hash = 'scrypt$aa7950f349d543357e9fbf2a9de55e5a$7c42b24e936c217336ba393207b3e987b3ffebe66bf4f69623e7e102ca38c0c39603d838bb749a91d0501f03cec870f83aa40c37dfa0a15bb5e27846ce1f26ba' WHERE id = '00000000-0000-7000-8000-000000000201';

INSERT INTO memberships (id, member_id, plan_id, status, start_date, end_date) VALUES ('00000000-0000-7000-8000-000000000301', '00000000-0000-7000-8000-000000000201', '00000000-0000-7000-8000-000000000011', 'ACTIVE', current_date - 5, current_date + 25) ON CONFLICT (id) DO NOTHING;

INSERT INTO routines (id, gym_id, member_id, title, week_start) VALUES ('00000000-0000-7000-8000-000000000401', '00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000201', 'Fuerza · Semana 1', date_trunc('week', current_date)::date) ON CONFLICT (id) DO NOTHING;

INSERT INTO routine_exercises (id, routine_id, name, day_of_week, sets, reps, rest_seconds, sort_order) VALUES ('00000000-0000-7000-8000-000000000411', '00000000-0000-7000-8000-000000000401', 'Sentadilla', 1, 4, 8, 90, 1), ('00000000-0000-7000-8000-000000000412', '00000000-0000-7000-8000-000000000401', 'Press banca', 1, 4, 10, 90, 2), ('00000000-0000-7000-8000-000000000413', '00000000-0000-7000-8000-000000000401', 'Peso muerto', 3, 3, 5, 120, 3), ('00000000-0000-7000-8000-000000000414', '00000000-0000-7000-8000-000000000401', 'Dominadas', 3, 3, 10, 60, 4) ON CONFLICT (id) DO NOTHING;

INSERT INTO nutrition_plans (id, gym_id, member_id, title, calories, protein_g, carbs_g, fat_g) VALUES ('00000000-0000-7000-8000-000000000501', '00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000201', 'Volumen muscular', 2600, 180, 280, 75) ON CONFLICT (id) DO NOTHING;

INSERT INTO meals (id, plan_id, name, meal_time, calories, protein_g, carbs_g, fat_g, sort_order) VALUES ('00000000-0000-7000-8000-000000000511', '00000000-0000-7000-8000-000000000501', 'Desayuno · Huevo y avena', 'breakfast', 600, 35, 70, 18, 1), ('00000000-0000-7000-8000-000000000512', '00000000-0000-7000-8000-000000000501', 'Comida · Pollo y arroz', 'lunch', 850, 60, 95, 20, 2), ('00000000-0000-7000-8000-000000000513', '00000000-0000-7000-8000-000000000501', 'Cena · Salmón y papa', 'dinner', 750, 55, 70, 25, 3), ('00000000-0000-7000-8000-000000000514', '00000000-0000-7000-8000-000000000501', 'Snack · Whey y plátano', 'snack', 400, 30, 45, 12, 4) ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (id, gym_id, title, starts_at, duration_minutes, capacity) VALUES ('00000000-0000-7000-8000-000000000601', '00000000-0000-7000-8000-000000000001', 'HYROX · Motor Engine', now() + interval '1 day', 60, 16) ON CONFLICT (id) DO NOTHING;

INSERT INTO class_bookings (id, class_id, member_id, status) VALUES ('00000000-0000-7000-8000-000000000611', '00000000-0000-7000-8000-000000000601', '00000000-0000-7000-8000-000000000201', 'BOOKED') ON CONFLICT (id) DO NOTHING;
