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

## Probar en un iPhone propio (sin TestFlight)

Con un Mac y un Apple ID gratuito se puede instalar la app por cable, sin publicarla ni pagar
Apple Developer. No genera un link HTTP de descarga: Xcode instala el binario directamente.

1. Abrir `apps/mobile-ios/LudusGYM.xcodeproj` en Xcode 16 o superior.
2. Target `LudusGYM` → *Signing & Capabilities* → marcar *Automatically manage signing* y elegir
   tu Apple ID en *Team* (aparece como *Personal Team*). Si el bundle id `com.ludus.gym.ios`
   está ocupado para esa cuenta, cámbialo solo para la prueba (por ejemplo `com.tuUsuario.ludusgym`).
3. Conectar el iPhone por USB, desbloquearlo y aceptar *Confiar en este equipo*.
4. En el selector de dispositivos del scheme `LudusGYM` elegir el iPhone (no un simulador).
5. Product → Run (`⌘R`). Xcode compila, firma con el certificado gratuito e instala la app.
6. En el iPhone: Ajustes → General → VPN y administración de dispositivos → perfil de desarrollador
   → *Confiar*. Después ya se puede abrir la app desde la pantalla de inicio.

La firma gratuita caduca a los 7 días: vuelve a conectar el iPhone y pulsa `⌘R` para renovarla.
Para comprobar el deep link de verificación:

```bash
xcrun devicectl device openurl --device EL_UDID 'ludusgym://verify-email?token=EL_TOKEN_DEL_CORREO'
```

Si necesitas un enlace que se pueda enviar a otras personas, usa TestFlight (sección siguiente):
requiere cuenta de Apple Developer y subir el archive a App Store Connect.

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
