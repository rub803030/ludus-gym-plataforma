"""Verificación final del monorepo Ludus GYM."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
errors: list[str] = []
checks: list[str] = []
skips: list[str] = []

required = [
    "apps/api/src/main.ts",
    "apps/api/prisma/schema.prisma",
    "apps/api/src/modules/auth/email-verification.ts",
    "apps/api/src/shared/email.ts",
    "apps/web/src/app/login/page.tsx",
    "apps/web/src/app/verify-email/page.tsx",
    "apps/web/src/features/auth/VerifyEmail/VerifyEmail.tsx",
    "apps/web/src/app/(console)/dashboard/page.tsx",
    "apps/mobile/app/src/main/java/com/ludus/gym/ui/navigation/NavGraph.kt",
    "apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/auth/authScreens.kt",
    "apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/qr/qrScreens.kt",
    "apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/home/homeScreens.kt",
    "apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/workout/workoutScreens.kt",
    "apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/nutrition/nutritionScreens.kt",
    "apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/bookings/bookingsScreens.kt",
    "infra/supabase/migrations/0001_init.sql",
    "infra/supabase/migrations/0002_member_auth.sql",
    "infra/supabase/migrations/0005_email_verification.sql",
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
    if not path.is_file() or ignored(path) or path.suffix not in {".ts", ".tsx", ".kt", ".sql", ".md", ".xml", ".yaml"}:
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

def run(label: str, cmd: list[str], cwd: Path, timeout: int) -> None:
    try:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        if result.returncode == 0:
            checks.append(f"OK  {label}")
        else:
            errors.append(f"FAIL {label}\n{result.stdout[-3000:]}\n{result.stderr[-3000:]}")
    except FileNotFoundError:
        skips.append(f"SKIP {label} (comando no disponible)")
    except subprocess.TimeoutExpired:
        errors.append(f"TIMEOUT {label}")

pnpm = shutil.which("pnpm")
commands = [
    ("API typecheck", ["--filter", "@ludus/api", "typecheck"]),
    ("API tests", ["--filter", "@ludus/api", "test"]),
    ("Shared build", ["--filter", "@ludus/shared", "build"]),
    ("Web typecheck", ["--filter", "@ludus/web", "typecheck"]),
    ("Web build", ["--filter", "@ludus/web", "build"]),
]
if pnpm:
    for label, args in commands:
        run(label, [pnpm] + args, root, 300)
else:
    for label, _ in commands:
        skips.append(f"SKIP {label} (pnpm no disponible)")

# El móvil se verifica cuando hay JDK y SDK disponibles; en CI lo cubre el job android.
mobile = root / "apps" / "mobile"
gradlew = mobile / ("gradlew.bat" if os.name == "nt" else "gradlew")
if not gradlew.exists():
    skips.append("SKIP Mobile tests y lint (falta el wrapper de Gradle)")
elif not os.environ.get("JAVA_HOME") and not shutil.which("java"):
    skips.append("SKIP Mobile tests y lint (JAVA_HOME/java no disponible)")
else:
    gradle_cmd = [str(gradlew)] if os.name == "nt" else ["bash", "gradlew"]
    run(
        "Mobile tests y lint (Gradle)",
        gradle_cmd + [":app:testDebugUnitTest", ":app:lintDebug", "--no-daemon"],
        mobile,
        900,
    )

for line in checks:
    print(line)
for line in skips:
    print(line)
if errors:
    print("\nERRORES:")
    for error in errors:
        print(" -", error)
    sys.exit(1)
print("\nTODAS LAS VERIFICACIONES PASARON")
