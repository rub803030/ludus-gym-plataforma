# Ludus GYM Platform

Plataforma integral de gestión operativa, financiera y de entrenamiento para **Ludus GYM**.

## Plataformas

| App | Tecnología | Público |
| --- | --- | --- |
| `apps/web` | Next.js App Router + TypeScript + Tailwind | OWNER / MANAGER / STAFF |
| `apps/api` | Node.js + TypeScript + Fastify, arquitectura limpia por dominio | Backend |
| `apps/mobile` | Android nativo (Kotlin + Jetpack Compose) | MEMBER |
| `apps/mobile-ios` | iOS nativo (Swift + SwiftUI) | MEMBER |
| `packages/shared` | Zod + tipos + matriz RBAC | Compartido |

## Estado

**Fase 5 — App de socios completada.** API, consola web y app Android funcionales sobre
Supabase, con RLS en 26/26 tablas, CSRF, rate limit distribuido, cifrado de campos
médicos, AAB firmado, despliegue público y verificación obligatoria de correo para
STAFF y SOCIOS mediante Resend. La app de socios usa la API pública de Fly.io, guarda
la credencial QR firmada por el servidor y ofrece las cinco pantallas cableadas:
Inicio, pase QR, Entrenamiento, Nutrición y Reservas. El comprobante de cobro
muestra un QR escaneable y el tema (luna/sol) se elige desde cualquier página.

## Módulos incluidos

Socios y membresías · cobros/caja con idempotencia · control de acceso con QR dinámico
y offline, con lector de cámara en la consola web y pegado manual como respaldo ·
rutinas y nutrición · clases e inventario · reportes y auditoría · gestión de staff ·
almacenamiento con URLs prefirmadas · notificaciones Socket.io.

## Arranque local

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose -f infra/docker/compose.yaml up -d
pnpm --filter @ludus/api db:generate
python scripts/apply-all-migrations.py
pnpm dev
```

Android: abrir `apps/mobile` con Android Studio y sincronizar Gradle.
Para generar el release firmado sigue `docs/runbooks/android-release.md`.

iOS: abrir `apps/mobile-ios/LudusGYM.xcodeproj` con Xcode 16 o superior y ejecutar el scheme `LudusGYM`.
Para firma, versionado y TestFlight sigue `docs/runbooks/ios-release.md`.

## Seguridad

La web rechaza credenciales de `MEMBER`. El móvil rechaza credenciales de staff.
El pase QR rota cada 30 s y se firma con HMAC-SHA256. Los cobros son idempotentes.
Las mutaciones web exigen token CSRF; las sesiones usan cookies Secure + HttpOnly +
SameSite=Strict en producción y los campos médicos se cifran con AES-256-GCM.
El acceso exige correo verificado: el enlace es de un solo uso, expira en 30 minutos
y solo se persiste su hash SHA-256. Las pruebas unitarias cubren ViewModels de reservas
y nutrición y la expiración del pase QR.

## Verificación y despliegue

Producción: https://ludus-gym-plataforma.vercel.app

Descarga de la app Android para socios: https://ludus-gym-plataforma.vercel.app/apk

```bash
python scripts/test-api-flows.py     # flujos extremo a extremo (verifica correos demo)
python scripts/verify-all.py         # typecheck + tests + builds
```

El alta de STAFF o SOCIO envía automáticamente un correo de confirmación. Mientras no se
confirme, el login responde `403 EMAIL_NOT_VERIFIED`; la web ofrece reenviar el enlace y
la app permite abrir la web o pegar el código recibido.

- `docs/DEPLOYMENT.md` — arquitectura, variables y checklist de venta.
- `docs/CONFIGURATION.md` — configuración centralizada y URL pública.
- `docs/USER_GUIDE.md` — guía de uso para el gimnasio.
- `docs/runbooks/` — backups, rotación de secretos, incidentes, despliegue, Android e iOS.

## Soporte y licenciamiento

El propietario de la instalación es responsable de rotar los secretos de demo antes de
facturar, activar backups automáticos en Supabase y custodiar el keystore de Android.
Los runbooks de `docs/runbooks/` definen los procedimientos de operación y escalado.
