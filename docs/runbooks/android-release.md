# Runbook — Release de Android (AAB firmado)

## Requisito previo

El keystore de release **no está en el repositorio**. Debe generarse una vez y guardarse en un lugar seguro con copia de respaldo. Perderlo impide publicar actualizaciones en Play Console.

```powershell
keytool -genkeypair -v -keystore C:\ruta-segura\ludus-release.jks `
  -alias ludus -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=Ludus GYM, OU=Mobile, O=Ludus GYM, L=Mexico, ST=Mexico, C=MX"
```

## Firma local

Añadir a `apps/mobile/local.properties` (ignorado por Git):

```properties
LUDUS_RELEASE_STORE_FILE=C:\\ruta-segura\\ludus-release.jks
LUDUS_RELEASE_STORE_PASSWORD=<password>
LUDUS_RELEASE_KEY_ALIAS=ludus
LUDUS_RELEASE_KEY_PASSWORD=<password>
```

Compilar con JDK 21 portable (el JBR de Android Studio es Java 25 y no es compatible con Gradle 8.13):

```powershell
# Apunta JAVA_HOME a un JDK 21 instalado en tu máquina
$env:JAVA_HOME='C:\ruta\a\jdk-21'
cd apps\mobile
.\gradlew :app:bundleRelease --no-daemon
```

El AAB queda en `apps/mobile/app/build/outputs/bundle/release/app-release.aab`.

## Firma en CI

El workflow `release.yaml` espera estos secrets del repositorio:

- `LUDUS_RELEASE_KEYSTORE_B64`: keystore en base64.
- `LUDUS_RELEASE_STORE_PASSWORD`
- `LUDUS_RELEASE_KEY_ALIAS`
- `LUDUS_RELEASE_KEY_PASSWORD`

Sin ellos el AAB se genera sin firma y **no es publicable**. El workflow avisa con un warning.

## Preparación para Play Store

El proyecto ya compila con `compileSdk`/`targetSdk` 36, AGP 8.11.1 y Gradle 8.13, e incluye la
política de privacidad y las notas de versión. La subida a Play está preparada en `release.yaml`
pero permanece inactiva hasta configurar el service account. El procedimiento completo está en
`docs/runbooks/play-store.md`.

## Publicación

1. Subir el AAB a Play Console → **Testing interno**.
2. Verificar instalación y login con un socio de prueba.
3. Promocionar a producción gradualmente (10 % → 100 %).
4. Registrar versión, `versionCode` y hash del AAB.
