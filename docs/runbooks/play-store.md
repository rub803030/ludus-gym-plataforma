# Runbook — Publicación futura en Google Play Store

Este proyecto está preparado para publicar `apps/mobile` en Play Store, pero **no publica nada
automáticamente**. La subida solo se ejecuta cuando existen los secretos y se empuja un tag `v*`.

## Estado de la preparación

- Paquete: `com.ludus.gym`.
- Versión actual: `0.2.0` (`versionCode = 4`). Subir `versionCode` en cada AAB enviado.
- `compileSdk = 36` y `targetSdk = 36`: cumple el requisito de Play desde el 31 de agosto de 2026.
- AGP 8.11.1 + Gradle 8.13 + Kotlin 2.2.21: compatibles con API 36 y con la alineación de
  bibliotecas nativas a 16 KB que exige Play para apps con `targetSdk >= 35`.
- CameraX 1.5.3 y ML Kit 17.3.0: las librerías nativas de 64 bits quedan alineadas a 16 KB.
  Verificar cada AAB con `python scripts/check-16kb.py ruta/app-release.aab`.
- Permisos del manifest: `INTERNET`, `ACCESS_NETWORK_STATE` y `CAMERA` (cámara opcional).
- Política de privacidad pública: https://ludus-gym-plataforma.vercel.app/privacidad.
  También está enlazada desde la pantalla de acceso y de registro de la app.
- Notas de versión: `distribution/whatsnew/whatsnew-es-MX`.

## Antes del primer tag

1. Crear la cuenta de Play Console (25 USD únicos) y la app con el paquete `com.ludus.gym`.
2. En *Configuración de la app → Firma de la app*, inscribirse en Play App Signing. Conservar el
   keystore local como clave de carga; la clave de firma final la gestiona Play.
3. Crear un service account en Google Cloud, activar la API *Google Play Android Developer* y
   invitar al correo del service account desde *Usuarios y permisos* de Play Console con permisos
   de administrador o de lanzamiento.
4. Subir manualmente un primer AAB a *Testing interno*. La API no puede crear el paquete: el
   proyecto debe existir antes de que el workflow pueda publicar.
5. Completar la ficha: descripción, capturas, icono, categoría, clasificación y **Declaración de
   datos** (correo, identificador de dispositivo, datos de membresía, entrenamiento, nutrición y
   compras). La URL de privacidad debe ir en el campo correspondiente.
6. Para cuentas personales nuevas, completar la prueba cerrada con 12 testers durante 14 días
   antes de solicitar producción.

## Secretos del repositorio

El workflow `release.yaml` usa los secretos existentes de firma y estos adicionales:

| Secreto | Contenido |
| --- | --- |
| `LUDUS_RELEASE_KEYSTORE_B64` | keystore de release en base64 |
| `LUDUS_RELEASE_STORE_PASSWORD` | contraseña del almacén |
| `LUDUS_RELEASE_KEY_ALIAS` | alias de la clave |
| `LUDUS_RELEASE_KEY_PASSWORD` | contraseña de la clave |
| `PLAY_SERVICE_ACCOUNT_JSON` | contenido completo del JSON del service account |

Ninguno se versiona. Si falta cualquiera, el job `play-upload` omite la subida con un aviso y el
resto del release sigue funcionando.

## Flujo de publicación

Al empujar un tag `v*`:

1. `api-web` compila, prueba y publica las imágenes del API.
2. `android` genera el AAB firmado, lo guarda como artefacto junto con `mapping.txt`.
3. `play-upload` descarga el artefacto y crea un release **en borrador** en el canal `internal`.

El borrador se revisa en Play Console. Para publicarlo a testers, cambiar `status: draft` por
`status: completed` en `release.yaml` o completar el release desde la consola. Después de validar,
promocionar a producción de forma gradual (10 % → 100 %).

## Comprobaciones antes de promocionar

- Instalar el AAB desde *Testing interno* e iniciar sesión con un socio verificado.
- Probar el pase QR, el modo sin conexión y el deep link `ludusgym://verify-email?token=...`.
- Confirmar que la política de privacidad se abre desde la app.
- Revisar que la *Declaración de datos* coincida con los permisos y las pantallas reales.
- Ejecutar `python scripts/check-16kb.py apps/mobile/app/build/outputs/apk/release/app-release.apk`
  (o el AAB) y confirmar que todas las librerías de 64 bits indiquen `OK`. Si Play avisa de
  bibliotecas nativas, revisar también la pestaña *Alignment* del APK Analyzer; los SDK externos
  deben seguir siendo compatibles en futuras actualizaciones.

## Usuarios del APK actual

La descarga directa en https://ludus-gym-plataforma.vercel.app/apk seguirá disponible. Quienes
instalaron ese APK **no reciben actualizaciones automáticas de Play**: al publicar, deben
desinstalarlo e instalar la versión de la tienda.
