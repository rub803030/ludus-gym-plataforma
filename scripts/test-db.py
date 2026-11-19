import os
import psycopg2
from pathlib import Path

root = Path(__file__).resolve().parents[1]
env = {}
for line in (root / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()

url = env["DATABASE_URL"]
print("Testing Supabase connection...")
conn = psycopg2.connect(url, connect_timeout=20)
cur = conn.cursor()
cur.execute("SELECT version(), current_database(), current_user;")
print("OK:", cur.fetchone()[0][:60])
cur.execute("SELECT extname FROM pg_extension ORDER BY extname;")
print("Extensions:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;")
print("Public tables:", [r[0] for r in cur.fetchall()])
conn.close()
