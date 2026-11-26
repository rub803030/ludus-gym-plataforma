# Runbook — release de la app iOS

## Requisitos

- macOS con Xcode 16 o superior y Command Line Tools.
- Cuenta de Apple Developer para firma y TestFlight. Los secretos y perfiles **no** se versionan.
- Scheme compartido: `LudusGYM` (`apps/mobile-ios/LudusGYM.xcodeproj/xcshareddata/xcschemes/LudusGYM.xcscheme`).

## Verificación antes de publicar

Desde la raíz del monorepo:

```bash
cd apps/mobile-ios
xcodebuild -scheme LudusGYM \
  -destination 'generic/platform=iOS Simulator' \
  test
xcodebuild -scheme LudusGYM \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/LudusGYM.xcarchive \
  CODE_SIGNING_ALLOWED=NO archive
cd ../..
python scripts/verify-all.py
git status --short
```

## Firma y distribución

1. Abrir `apps/mobile-ios/LudusGYM.xcodeproj`.
2. Seleccionar el target `LudusGYM` → *Signing & Capabilities* y elegir el equipo.
   El bundle id es `com.ludus.gym.ios`; no cambiarlo sin actualizar el deep link.
3. Actualizar `MARKETING_VERSION` y `CURRENT_PROJECT_VERSION` en el proyecto antes de cada envío
   (la versión actual es `0.2.0` / `4`, alineada con Android).
4. Product → Archive → Validate App → Distribute App → App Store Connect.
5. Registrar versión, build, fecha, responsable y resultado del envío a TestFlight.

## Deep link

El esquema es `ludusgym`. Para probar la verificación por correo:

```bash
xcrun simctl openurl booted 'ludusgym://verify-email?token=EL_TOKEN_DEL_CORREO'
```

## Seguridad

- Los tokens se guardan solo en Keychain con `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
- No imprimir tokens, correos completos ni respuestas crudas en logs.
- No subir certificados, perfiles de firma ni `.env` al repositorio.
- ATS permanece estricto (solo HTTPS). No habilitar `NSAllowsArbitraryLoads` en Release.

## Gaps de API conocidos

`GET /api/access/occupancy` y `GET /api/payments` requieren permisos que un `MEMBER` no tiene:
la app muestra «Aforo no disponible» y los comprobantes guardados en caché. No implementar
`POST /api/access/events` ni `POST /api/auth/mobile/refresh` porque no existen en la API.
