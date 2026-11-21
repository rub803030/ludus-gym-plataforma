"""Genera el seed demo con hashes scrypt compatibles con apps/api/src/shared/password.ts."""
import hashlib
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
gym_id = "00000000-0000-7000-8000-000000000001"


def scrypt_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=16384,
        r=8,
        p=1,
        dklen=64,
        maxmem=64 * 1024 * 1024,
    )
    return f"scrypt${salt.hex()}${digest.hex()}"


staff = [
    ("00000000-0000-7000-8000-000000000101", "rubnlira2@gmail.com", "Owner2026!", "Ricardo Dueño", "OWNER"),
    ("00000000-0000-7000-8000-000000000102", "rubnlira2+manager@gmail.com", "Manager2026!", "Mariana Encargado", "MANAGER"),
    ("00000000-0000-7000-8000-000000000103", "rubnlira2+staff@gmail.com", "Staff2026!", "Sofía Recepción", "STAFF"),
]

member_id = "00000000-0000-7000-8000-000000000201"
member_hash = scrypt_hash("Ludus2026!")

lines = [
    "-- Datos demo de Ludus GYM (SOLO desarrollo).",
    "-- Correos: rubnlira2 (owner), rubnlira2+manager/+staff/+socio@gmail.com (requieren verificación).",
    "-- Passwords: Owner2026!, Manager2026!, Staff2026!, Ludus2026!",
    "",
]
for uid, email, password, name, role in staff:
    lines.append(
        "INSERT INTO staff_users (id, gym_id, email, password_hash, full_name, role, is_active) "
        f"VALUES ('{uid}', '{gym_id}', '{email}', '{scrypt_hash(password)}', '{name}', '{role}', true) "
        "ON CONFLICT (id) DO NOTHING;"
    )

lines += [
    "",
    f"INSERT INTO members (id, gym_id, code, first_name, last_name, email, phone, document_type, "
    "document_number, birth_date, status, joined_at) "
    f"VALUES ('{member_id}', '{gym_id}', 'LUD-000001', 'Ana', 'Martínez', 'rubnlira2+socio@gmail.com', "
    "'+52 55 1234 5678', 'INE', 'MART890123ABC', '1998-03-12', 'ACTIVE', now()) "
    "ON CONFLICT (id) DO NOTHING;",
    "",
    "-- La columna password_hash se agrega en 0002_member_auth.sql",
    f"UPDATE members SET password_hash = '{member_hash}' WHERE id = '{member_id}';",
    "",
    f"INSERT INTO memberships (id, member_id, plan_id, status, start_date, end_date) "
    f"VALUES ('00000000-0000-7000-8000-000000000301', '{member_id}', "
    "'00000000-0000-7000-8000-000000000011', 'ACTIVE', current_date - 5, current_date + 25) "
    "ON CONFLICT (id) DO NOTHING;",
    "",
    f"INSERT INTO routines (id, gym_id, member_id, title, week_start) "
    f"VALUES ('00000000-0000-7000-8000-000000000401', '{gym_id}', '{member_id}', "
    "'Fuerza · Semana 1', date_trunc('week', current_date)::date) ON CONFLICT (id) DO NOTHING;",
    "",
    "INSERT INTO routine_exercises (id, routine_id, name, day_of_week, sets, reps, rest_seconds, sort_order) VALUES "
    "('00000000-0000-7000-8000-000000000411', '00000000-0000-7000-8000-000000000401', 'Sentadilla', 1, 4, 8, 90, 1), "
    "('00000000-0000-7000-8000-000000000412', '00000000-0000-7000-8000-000000000401', 'Press banca', 1, 4, 10, 90, 2), "
    "('00000000-0000-7000-8000-000000000413', '00000000-0000-7000-8000-000000000401', 'Peso muerto', 3, 3, 5, 120, 3), "
    "('00000000-0000-7000-8000-000000000414', '00000000-0000-7000-8000-000000000401', 'Dominadas', 3, 3, 10, 60, 4) "
    "ON CONFLICT (id) DO NOTHING;",
    "",
    f"INSERT INTO nutrition_plans (id, gym_id, member_id, title, calories, protein_g, carbs_g, fat_g) "
    f"VALUES ('00000000-0000-7000-8000-000000000501', '{gym_id}', '{member_id}', "
    "'Volumen muscular', 2600, 180, 280, 75) ON CONFLICT (id) DO NOTHING;",
    "",
    "INSERT INTO meals (id, plan_id, name, meal_time, calories, protein_g, carbs_g, fat_g, sort_order) VALUES "
    "('00000000-0000-7000-8000-000000000511', '00000000-0000-7000-8000-000000000501', "
    "'Desayuno · Huevo y avena', 'breakfast', 600, 35, 70, 18, 1), "
    "('00000000-0000-7000-8000-000000000512', '00000000-0000-7000-8000-000000000501', "
    "'Comida · Pollo y arroz', 'lunch', 850, 60, 95, 20, 2), "
    "('00000000-0000-7000-8000-000000000513', '00000000-0000-7000-8000-000000000501', "
    "'Cena · Salmón y papa', 'dinner', 750, 55, 70, 25, 3), "
    "('00000000-0000-7000-8000-000000000514', '00000000-0000-7000-8000-000000000501', "
    "'Snack · Whey y plátano', 'snack', 400, 30, 45, 12, 4) "
    "ON CONFLICT (id) DO NOTHING;",
    "",
    f"INSERT INTO classes (id, gym_id, title, starts_at, duration_minutes, capacity) "
    f"VALUES ('00000000-0000-7000-8000-000000000601', '{gym_id}', 'HYROX · Motor Engine', "
    "now() + interval '1 day', 60, 16) ON CONFLICT (id) DO NOTHING;",
    "",
    f"INSERT INTO class_bookings (id, class_id, member_id, status) "
    f"VALUES ('00000000-0000-7000-8000-000000000611', "
    "'00000000-0000-7000-8000-000000000601', '" + member_id + "', 'BOOKED') ON CONFLICT (id) DO NOTHING;",
    "",
]

out = root / "infra/supabase/seed/0002_demo_data.sql"
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out.relative_to(root)}")
