-dontwarn kotlinx.**
-dontwarn com.google.errorprone.annotations.**
-keep class com.ludus.gym.data.remote.dto.** { *; }
-keepclassmembers class * {
  @com.squareup.moshi.FromJson *;
  @com.squareup.moshi.ToJson *;
}
