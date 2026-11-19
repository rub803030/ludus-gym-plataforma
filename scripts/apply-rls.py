import psycopg2
from pathlib import Path

root = Path(__file__).resolve().parents[1]
env = {}
for line in (root / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()

conn = psycopg2.connect(env["DATABASE_URL"], connect_timeout=20)
conn.autocommit = True
cur = conn.cursor()
sql = (root / "infra/supabase/migrations/0003_rls_all.sql").read_text(encoding="utf-8")
cur.execute(sql)
print("RLS migration OK")
cur.execute("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=true")
print("Tables with RLS:", cur.fetchone()[0])
conn.close()
