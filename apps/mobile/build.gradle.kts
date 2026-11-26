plugins {
  // AGP 8.11 es la primera versión estable compatible con API 36 y con
  // alineación de librerías nativas a 16 KB, exigida por Play para targetSdk 35+.
  id("com.android.application") version "8.11.1" apply false
  id("org.jetbrains.kotlin.android") version "2.2.21" apply false
  id("org.jetbrains.kotlin.plugin.compose") version "2.2.21" apply false
  id("com.google.devtools.ksp") version "2.2.21-2.0.5" apply false
}
