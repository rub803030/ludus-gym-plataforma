# Ludus GYM — app iOS (MEMBER)

App iOS nativa de socios, equivalente a `apps/mobile` (Android). Es **exclusiva para `MEMBER`**: un `STAFF`/`OWNER`/`MANAGER` recibe `401` en `/api/auth/mobile/login` y no entra.

- Target/Scheme: `LudusGYM`
- Bundle id: `com.ludus.gym.ios`
- Versión: `0.2.0` (`CURRENT_PROJECT_VERSION = 4`)
- Deployment target: iOS 17+
- Dispositivos: iPhone y iPad
- Idioma: español
- API: `https://ludus-gym-plataforma-api.fly.dev`

## Cómo abrirla

Abrir `apps/mobile-ios/LudusGYM.xcodeproj` con Xcode 16 o superior y ejecutar el scheme `LudusGYM`.
El proyecto no incluye firma: en Xcode selecciona tu equipo en *Signing & Capabilities* antes de distribuir.

```bash
cd apps/mobile-ios
xcodebuild -scheme LudusGYM \
  -destination 'generic/platform=iOS Simulator' \
  test
xcodebuild -scheme LudusGYM \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/LudusGYM.xcarchive \
  CODE_SIGNING_ALLOWED=NO archive
```

## Estructura

```
apps/mobile-ios/
├── LudusGYM.xcodeproj/          # proyecto + scheme compartido LudusGYM
├── LudusGYM/
│   ├── LudusGYMApp.swift        # @main, registro de BGTaskScheduler
│   ├── RootView.swift           # NavigationStack + deep link + sync en primer plano
│   ├── Info.plist               # esquema ludusgym, permiso de cámara, ATS estricto
│   ├── Core/
│   │   ├── API/                 # APIClient (Bearer + refresh), DTOs, errores
│   │   ├── Security/            # Keychain (5 claves), sesión
│   │   ├── Storage/             # caché y cola offline (JSON en Application Support)
│   │   └── Network/             # NWPathMonitor
│   ├── Domain/                  # modelos, parseo de QR y QR de inscripción
│   ├── Design/                  # paleta luna/sol, componentes, render QR
│   ├── Repositories/            # auth, gyms, QR, workout, nutrición, reservas, sync
│   ├── Navigation/              # AppRouter (11 rutas y startDestination)
│   └── Screens/                 # vistas + ViewModels
└── LudusGYMTests/               # XCTest: QR, enrollment, errores, contrato y Keychain
```

## Contratos implementados

- **Roles y verificación**: login con `platform: "mobile"`; `403 EMAIL_NOT_VERIFIED` abre la pantalla de verificación. Deep link `ludusgym://verify-email?token=...`.
- **Keychain**: `access_token`, `refresh_token`, `member_id`, `active_gym_id`, `device_id` con `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. `device_id` no se borra al cerrar sesión; `active_gym_id` se conserva en el refresh.
- **Refresh 401**: concurrente-safe con una sola `Task` en vuelo; usa únicamente `POST /api/auth/refresh`.
- **Multi-gimnasio**: `join-gym` y `switch-gym` guardan los `tokens` devueltos por el servidor **antes** de navegar.
- **Pase QR**: `POST /api/access/qr-token`, render del token firmado por el servidor, cuenta regresiva de 30 s, credencial offline cacheada 10 min y filtrada por `gymId`. Sin gimnasio no se genera QR: se muestra «Unase a algun gimnasio para tener acceso».
- **Escáner**: `AVCaptureSession` con `FORMAT_QR_CODE`; acepta el QR estático `gym-enroll` y el código `LUDUS-XXXX`.
- **Offline**: series de entrenamiento encoladas en disco y drenadas al recuperar red o entrar en primer plano.
- **Tema**: selector luna/sol con `UIColor`/`ColorScheme`; paleta Kinetic Obsidian; cifras con dígitos tabulares; área táctil ≥ 48 pt.

## Gaps conocidos de la API (no se inventan datos)

- `GET /api/access/occupancy` y `GET /api/payments` exigen permisos que `MEMBER` no tiene. La app muestra «Aforo no disponible» y solo comprobantes previamente guardados cuando la API responde `403`.
- `POST /api/access/events` no existe en la API: no se encola. El botón «Copiar código» solo copia el pase.
- `POST /api/auth/mobile/refresh` no existe: se usa `/api/auth/refresh`.

## Pruebas

`LudusGYMTests` cubre parseo de pase y credencial offline, filtrado por `gymId`, QR de inscripción, traducción de `CROSS_GYM_PASS`/`NO_GYM`, decodificación de `tokens` de `join-gym` y conservación de `active_gym_id`/`device_id` en Keychain.
