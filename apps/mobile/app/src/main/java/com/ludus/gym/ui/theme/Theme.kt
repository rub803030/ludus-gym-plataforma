package com.ludus.gym.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val DarkColors = darkColorScheme(
    primary = Volt,
    onPrimary = Canvas,
    primaryContainer = SurfaceRaised,
    onPrimaryContainer = Volt,
    secondary = Ignition,
    onSecondary = Color.White,
    tertiary = Emerald,
    onTertiary = Canvas,
    background = Canvas,
    onBackground = Ink,
    surface = Surface,
    onSurface = Ink,
    surfaceVariant = SurfaceRaised,
    onSurfaceVariant = Muted,
    outline = Color(0x1FFFFFFF),
    error = Ignition,
    onError = Color.White,
)

private val LudusShapes = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
)

/** Kinetic Obsidian es siempre oscuro: el parámetro se mantiene por compatibilidad. */
@Composable
fun LudusTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColors,
        typography = LudusTypography,
        shapes = LudusShapes,
        content = content,
    )
}
