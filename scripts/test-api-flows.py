"""Prueba extremo a extremo de la API contra Supabase."""
import json
import urllib.error
import urllib.request
import uuid

BASE = "http://localhost:4000"
FAILURES = []


def call(method, path, body=None, token=None, headers=None):
    request_headers = {"Content-Type": "application/json"}
    if token:
        request_headers["Authorization"] = f"Bearer {token}"
    if headers:
        request_headers.update(headers)
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers=request_headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            cookies = response.headers.get_all("Set-Cookie") or []
            return response.status, (json.loads(raw) if raw else {}), cookies
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(raw), []
        except json.JSONDecodeError:
            return exc.code, raw, []


def check(label, method, path, body=None, token=None, headers=None, expect=200):
    status, data, cookies = call(method, path, body, token, headers)
    ok = status in (expect if isinstance(expect, tuple) else (expect,))
    print(f"{'OK  ' if ok else 'FAIL'} {label}: {status}")
    if not ok:
        FAILURES.append(label)
        print("     ", json.dumps(data, ensure_ascii=False)[:500])
    return data if ok else None


print("== Health ==")
check("health", "GET", "/health")

print("\n== Verificación de correo ==")
OWNER_EMAIL = "rubnlira2+owner@gmail.com"
SOCIO_EMAIL = "rubnlira2+socio@gmail.com"
status, blocked, _ = call("POST", "/api/auth/web/login", {"email": OWNER_EMAIL, "password": "Owner2026!", "platform": "web"})
code = blocked.get("error", {}).get("code") if isinstance(blocked, dict) else None
if status == 403 and code == "EMAIL_NOT_VERIFIED":
    print("OK  login bloqueado antes de verificar: 403 EMAIL_NOT_VERIFIED")
else:
    FAILURES.append("login bloqueado antes de verificar")
    print(f"FAIL login bloqueado antes de verificar: {status} {code}")


def verify_demo_account(email, platform):
    status, sent, _ = call("POST", "/api/auth/verify-email/resend", {"email": email, "platform": platform})
    token = sent.get("devToken") if isinstance(sent, dict) else None
    if status != 200 or not token:
        FAILURES.append(f"reenvío de verificación ({email})")
        print(f"FAIL reenvío de verificación ({email}): {status} {sent}")
        return
    check("verificación de correo", "POST", "/api/auth/verify-email", {"token": token})


verify_demo_account(OWNER_EMAIL, "web")
verify_demo_account(SOCIO_EMAIL, "mobile")

status, invalid, _ = call("POST", "/api/auth/verify-email", {"token": "token-no-valido"})
code = invalid.get("error", {}).get("code") if isinstance(invalid, dict) else None
if status == 400 and code == "VERIFICATION_TOKEN_INVALID":
    print("OK  token inválido rechazado: 400 VERIFICATION_TOKEN_INVALID")
else:
    FAILURES.append("token inválido rechazado")
    print(f"FAIL token inválido rechazado: {status} {code}")

print("\n== Autenticación web ==")
status, login_data, cookies = call("POST", "/api/auth/web/login", {"email": OWNER_EMAIL, "password": "Owner2026!", "platform": "web"})
WEB = {"Cookie": "; ".join(c.split(";")[0] for c in cookies if "ludus_" in c), "X-CSRF-Token": login_data.get("csrfToken", "")}
print("Cookies:", len(WEB["Cookie"].split("; ")))
check("CSRF requerido en mutación web", "POST", "/api/cash-sessions", {"startingAmount": 1}, headers={"Cookie": WEB["Cookie"]}, expect=403)
me = check("owner /me", "GET", "/api/auth/me", headers=WEB)
check("planes", "GET", "/api/plans", headers=WEB)
check("socios", "GET", "/api/members", headers=WEB)
check("resumen", "GET", "/api/reports/summary", headers=WEB)
check("corte de caja", "GET", "/api/reports/cash", headers=WEB)
check("auditoría", "GET", "/api/audit-logs", headers=WEB)
check("equipo", "GET", "/api/staff", headers=WEB)
check("inventario", "GET", "/api/inventory", headers=WEB)
check("QR denegado en web", "POST", "/api/access/qr-token", {}, headers={**WEB, "x-platform": "web"}, expect=403)
check("socio denegado en web", "POST", "/api/auth/web/login", {"email": SOCIO_EMAIL, "password": "Ludus2026!", "platform": "web"}, expect=403)

print("\n== Autenticación móvil ==")
member = check("socio login", "POST", "/api/auth/mobile/login", {"email": SOCIO_EMAIL, "password": "Ludus2026!", "platform": "mobile", "deviceId": "test-device-001"})
TOKEN = member["accessToken"] if member else None
check("socio /me", "GET", "/api/members/me", token=TOKEN)
qr = check("QR token", "POST", "/api/access/qr-token", {}, token=TOKEN)
check("rutinas", "GET", "/api/routines", token=TOKEN)
check("nutrición", "GET", "/api/nutrition-plans", token=TOKEN)
classes = check("clases", "GET", "/api/classes", token=TOKEN)
check("recibos", "GET", "/api/payments", headers=WEB)

print("\n== Cobro idempotente ==")
members_data = call("GET", "/api/members", headers=WEB)[1]
plans_data = call("GET", "/api/plans", headers=WEB)[1]
member_id = members_data["items"][0]["id"]
plan_id = plans_data[0]["id"]
idem = "ludus_" + str(uuid.uuid4())
charge_body = {"memberId": member_id, "planId": plan_id, "amount": plans_data[0]["price"], "currency": "MXN", "method": "card", "idempotencyKey": idem, "concept": "Mensualidad demo"}
charge = check("cobro", "POST", "/api/payments/charge", charge_body, headers={**WEB, "Idempotency-Key": idem}, expect=201)
check("doble cobre bloqueado", "POST", "/api/payments/charge", charge_body, headers={**WEB, "Idempotency-Key": idem}, expect=409)

print("\n== Check-in QR ==")
qr = check("QR fresco", "POST", "/api/access/qr-token", {}, token=TOKEN)
if qr:
    check("verificar QR", "POST", "/api/access/verify-qr", {"token": qr["token"], "deviceId": "door-01"}, headers=WEB)
    check("QR duplicado rechazado", "POST", "/api/access/verify-qr", {"token": qr["token"], "deviceId": "door-01"}, headers=WEB, expect=409)
check("check-in manual", "POST", "/api/access/manual-checkin", {"memberId": member_id, "notes": "Prueba receptor"}, headers=WEB, expect=201)
check("eventos de acceso", "GET", "/api/access/events", headers=WEB)
check("aforo", "GET", "/api/access/occupancy", headers=WEB)

print("\n== Administración ==")
check("abrir turno", "POST", "/api/cash-sessions", {"startingAmount": 500}, headers=WEB, expect=(200, 201))
sessions = call("GET", "/api/cash-sessions", headers=WEB)[1]
if sessions:
    check("cerrar turno", "POST", f"/api/cash-sessions/{sessions[0]['id']}/close", {"countedAmount": 500, "notes": "Cuadre demo"}, headers=WEB)
test_plan_name = "Plan Prueba " + uuid.uuid4().hex[:8]
check("crear plan", "POST", "/api/plans", {"name": test_plan_name, "durationDays": 30, "price": 599, "includesClasses": True, "includesNutrition": False}, headers=WEB, expect=201)
created_plan = next((p for p in call("GET", "/api/plans", headers=WEB)[1] if p["name"] == test_plan_name), None)
if created_plan:
    check("archivar plan", "DELETE", f"/api/plans/{created_plan['id']}", headers=WEB)
check("crear clase", "POST", "/api/classes", {"title": "HYROX Test", "startsAt": "2026-12-01T10:00:00.000Z", "durationMinutes": 60, "capacity": 20}, headers=WEB, expect=201)

print("\n== Resultado ==")
if FAILURES:
    print("FALLOS:", ", ".join(FAILURES))
    raise SystemExit(1)
print("TODOS LOS FLUJOS PASARON")
