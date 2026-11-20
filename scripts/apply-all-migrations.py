import psycopg2
from pathlib import Path

root = Path(__file__).resolve().parents[1]
env = {}
for line in (root / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()

# DDL debe ejecutarse contra la conexión directa (el pooler de Supabase no
# acepta algunos parámetros de libpq ni transacciones DDL largas).
dsn = env.get("DIRECT_URL") or env["DATABASE_URL"]
conn = psycopg2.connect(dsn, connect_timeout=20)
conn.autocommit = True
cur = conn.cursor()

for path in sorted((root / "infra/supabase/migrations").glob("*.sql")):
    print(f"Applying {path.name}...", end=" ")
    try:
        cur.execute(path.read_text(encoding="utf-8"))
        print("OK")
    except Exception as exc:
        if "already exists" in str(exc):
            print("already applied")
        else:
            print("ERROR")
            raise

for path in sorted((root / "infra/supabase/seed").glob("*.sql")):
    print(f"Seeding {path.name}...", end=" ")
    cur.execute(path.read_text(encoding="utf-8"))
    print("OK")

cur.execute("SELECT count(*) FROM staff_users;")
print("Staff users:", cur.fetchone()[0])
cur.execute("SELECT count(*) FROM members;")
print("Members:", cur.fetchone()[0])
cur.execute("SELECT count(*) FROM routines;")
print("Routines:", cur.fetchone()[0])
conn.close()
