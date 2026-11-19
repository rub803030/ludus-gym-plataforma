import psycopg2
from pathlib import Path

root = Path(__file__).resolve().parents[1]
env = {}
for line in (root / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()

files = [
    root / "infra/supabase/migrations/0001_init.sql",
    root / "infra/supabase/seed/0001_initial_seed.sql",
]

conn = psycopg2.connect(env["DATABASE_URL"], connect_timeout=20)
conn.autocommit = True
cur = conn.cursor()

for path in files:
    print(f"Applying {path.name}...")
    try:
        cur.execute(path.read_text(encoding="utf-8"))
        print("  OK")
    except Exception as exc:
        print(f"  ERROR: {exc}")
        raise

cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
print("Public tables created:", cur.fetchone()[0])
cur.execute("SELECT uuid_generate_v7();")
print("UUIDv7 sample:", cur.fetchone()[0])
cur.execute('SELECT name, slug, capacity FROM gyms;')
print("Gym:", cur.fetchone())
conn.close()
