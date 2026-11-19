"""Verificación final del monorepo Ludus GYM."""
from pathlib import Path
import json
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
errors: list[str] = []
checks: list[str] = []

required = [
    "apps/api/src/main.ts",
    "apps/api/prisma/schema.prisma",
    "apps/web/src/app/login/page.tsx",
    "apps/web/src/app/(console)/dashboard/page.tsx",
    "apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/qr/qrScreens.kt",
    "infra/supabase/migrations/0001_init.sql",
    "infra/supabase/migrations/0002_member_auth.sql",
]
for rel in required:
    if (root / rel).exists():
        checks.append(f"OK  {rel}")
    else:
        errors.append(f"MISSING {rel}")

IGNORED = {"node_modules", ".next", ".gradle", "build", "dist", ".turbo", ".pnpm-store"}

def ignored(path: Path) -> bool:
    return any(part in IGNORED for part in path.relative_to(root).parts)

for path in root.rglob("*.json"):
    if ignored(path):
        continue
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"BAD JSON {path.relative_to(root)}: {exc}")

for path in root.rglob("*"):
    if not path.is_file() or ignored(path) or path.suffix not in {".ts", ".tsx", ".kt", ".sql", ".md", ".xml"}:
        continue
    if path.name == "verify-all.py":
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        errors.append(f"NOT UTF-8 {path.relative_to(root)}")
        continue
    if "\ufffd" in text:
        errors.append(f"REPLACEMENT CHAR {path.relative_to(root)}")

pnpm = shutil.which("pnpm")
commands = [
    ("API typecheck", ["--filter", "@ludus/api", "typecheck"]),
    ("API tests", ["--filter", "@ludus/api", "test"]),
    ("Shared build", ["--filter", "@ludus/shared", "build"]),
    ("Web typecheck", ["--filter", "@ludus/web", "typecheck"]),
    ("Web build", ["--filter", "@ludus/web", "build"]),
]
for label, args in commands:
    cmd = [pnpm] + args if pnpm else args
    try:
        result = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            checks.append(f"OK  {label}")
        else:
            errors.append(f"FAIL {label}\n{result.stdout[-3000:]}\n{result.stderr[-3000:]}")
    except FileNotFoundError:
        errors.append(f"SKIP {label} (pnpm no disponible)")
    except subprocess.TimeoutExpired:
        errors.append(f"TIMEOUT {label}")

for line in checks:
    print(line)
if errors:
    print("\nERRORES:")
    for error in errors:
        print(" -", error)
    sys.exit(1)
print("\nTODAS LAS VERIFICACIONES PASARON")
