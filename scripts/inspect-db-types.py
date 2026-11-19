import psycopg2
from pathlib import Path

root = Path(__file__).resolve().parents[1]
env = {}
for line in (root / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()

conn = psycopg2.connect(env["DATABASE_URL"], connect_timeout=20)
cur = conn.cursor()
cur.execute("SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname")
print("ENUM TYPES:", [r[0] for r in cur.fetchall()])
cur.execute("""
SELECT table_name, column_name, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND udt_name NOT IN ('uuid','text','varchar','int4','int8','bool','timestamp without time zone',
                       'timestamp with time zone','date','numeric','bytea','jsonb','inet','citext','float8')
ORDER BY table_name, column_name
""")
for row in cur.fetchall():
    print("COLUMN:", row)
conn.close()
