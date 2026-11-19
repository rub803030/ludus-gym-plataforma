package com.ludus.gym.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Montserrat 800 para display, Inter para cuerpo. Se usa la familia del sistema
 *  como fallback para no empaquetar fuentes hasta definir los assets definitivos. */
private val DisplayFamily = FontFamily.SansSerif
private val BodyFamily = FontFamily.SansSerif

val LudusTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = DisplayFamily,
        fontSize = 44.sp,
        lineHeight = 48.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = (-0.03).sp,
    ),
    displayMedium = TextStyle(
        fontFamily = DisplayFamily,
        fontSize = 34.sp,
        lineHeight = 38.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = (-0.02).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = DisplayFamily,
        fontSize = 24.sp,
        lineHeight = 30.sp,
        fontWeight = FontWeight.Bold,
    ),
    titleLarge = TextStyle(
        fontFamily = DisplayFamily,
        fontSize = 20.sp,
        lineHeight = 26.sp,
        fontWeight = FontWeight.Bold,
    ),
    titleMedium = TextStyle(
        fontFamily = BodyFamily,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        fontWeight = FontWeight.SemiBold,
    ),
    bodyLarge = TextStyle(fontFamily = BodyFamily, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = BodyFamily, fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = BodyFamily, fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
)
