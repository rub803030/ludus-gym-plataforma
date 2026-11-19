from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
errors = []
files = [p for p in root.rglob("*") if p.is_file() and p.name != "verify_phase1.py"]

for p in files:
    raw = p.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        errors.append(f"NOT UTF-8: {p.relative_to(root)}")
        continue
    if "\ufffd" in text or re.search(r"Ã|â€|Â|ï¿½", text):
        errors.append(f"MOJIBAKE: {p.relative_to(root)}")

for p in root.rglob("*.json"):
    try:
        json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"BAD JSON: {p.relative_to(root)}: {exc}")

required = [
    "package.json", "pnpm-workspace.yaml", "turbo.json",
    "apps/api/src/main.ts", "apps/api/prisma/schema.prisma",
    "apps/web/src/app/page.tsx", "apps/mobile/settings.gradle.kts",
    "apps/mobile/app/build.gradle.kts",
    "packages/shared/src/constants/roles.ts",
    "packages/shared/src/constants/permissions.ts",
    "infra/supabase/migrations/0001_init.sql",
    "infra/supabase/seed/0001_initial_seed.sql",
    ".github/workflows/ci.yaml",
]
for rel in required:
    if not (root / rel).exists():
        errors.append(f"MISSING: {rel}")

sql = (root / "infra/supabase/migrations/0001_init.sql").read_text(encoding="utf-8")
for token in ["uuid_generate_v7", "CREATE TABLE members", "CREATE TABLE payments",
              "ENABLE ROW LEVEL SECURITY", "CREATE TYPE staff_role", "audit_logs"]:
    if token not in sql:
        errors.append(f"SQL MISSING TOKEN: {token}")

print(f"Checked {len(files)} files")
if errors:
    print("ERRORS:")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)
print("PHASE 1 VERIFICATION OK")
