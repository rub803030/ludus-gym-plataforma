import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("org.jetbrains.kotlin.plugin.compose")
  id("com.google.devtools.ksp")
}

// La firma de release se lee de local.properties (ignorado por git) o de
// propiedades de Gradle/ci. Nunca se versiona el keystore ni su contraseña.
val localProps = Properties().apply {
  val file = rootProject.file("local.properties")
  if (file.exists()) file.inputStream().use { load(it) }
}
fun signingProp(name: String): String? =
  providers.gradleProperty(name).orNull ?: localProps.getProperty(name)?.toString()

val storeFileProp = signingProp("LUDUS_RELEASE_STORE_FILE")
val storePasswordProp = signingProp("LUDUS_RELEASE_STORE_PASSWORD")
val keyAliasProp = signingProp("LUDUS_RELEASE_KEY_ALIAS")
val keyPasswordProp = signingProp("LUDUS_RELEASE_KEY_PASSWORD")
val hasReleaseSigning = listOf(storeFileProp, storePasswordProp, keyAliasProp, keyPasswordProp).all { !it.isNullOrBlank() }

android {
  namespace = "com.ludus.gym"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.ludus.gym"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  signingConfigs {
    if (hasReleaseSigning) {
      create("release") {
        storeFile = rootProject.file(storeFileProp!!)
        storePassword = storePasswordProp
        keyAlias = keyAliasProp
        keyPassword = keyPasswordProp
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      if (hasReleaseSigning) {
        signingConfig = signingConfigs.getByName("release")
      } else {
        // Permite compilar/release en CI sin secretos, pero el AAB queda
        // sin firmar y NO es publicable. La tarea avisa explícitamente.
        logger.warn("LUDUS_RELEASE_* sin configurar: el AAB de release no estará firmado.")
      }
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions { jvmTarget = "17" }

  buildFeatures { compose = true }
}

dependencies {
  val composeBom = platform("androidx.compose:compose-bom:2024.09.02")
  implementation(composeBom)
  androidTestImplementation(composeBom)

  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.activity:activity-compose:1.9.2")
  implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.material:material-icons-extended")
  implementation("androidx.navigation:navigation-compose:2.7.7")

  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
  implementation("androidx.security:security-crypto:1.1.0-alpha06")
  // Requerido por Tink al ofuscar con R8 (anotaciones de errorprone).
  implementation("com.google.errorprone:error_prone_annotations:2.28.0")
  implementation("androidx.room:room-runtime:2.6.1")
  implementation("androidx.room:room-ktx:2.6.1")
  ksp("androidx.room:room-compiler:2.6.1")

  implementation("com.squareup.retrofit2:retrofit:2.11.0")
  implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
  implementation("com.squareup.moshi:moshi-kotlin:1.15.1")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")

  implementation("com.google.zxing:core:3.5.3")
  implementation("androidx.work:work-runtime-ktx:2.9.1")
  implementation("androidx.core:core-splashscreen:1.0.1")

  debugImplementation("androidx.compose.ui:ui-tooling")
  testImplementation("junit:junit:4.13.2")
  androidTestImplementation("androidx.test.ext:junit:1.1.5")
  androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
