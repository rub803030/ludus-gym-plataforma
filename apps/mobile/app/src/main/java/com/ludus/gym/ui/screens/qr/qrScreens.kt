package com.ludus.gym.ui.screens.qr

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import com.ludus.gym.ui.components.LudusButton
import com.ludus.gym.ui.components.LudusButtonVariant
import com.ludus.gym.ui.theme.Emerald
import com.ludus.gym.ui.theme.Ignition
import com.ludus.gym.ui.theme.Ink
import com.ludus.gym.ui.theme.Muted
import com.ludus.gym.ui.theme.SurfaceRaised
import com.ludus.gym.ui.theme.Volt

@Composable
fun QrScreen(
    viewModel: QrViewModel,
    onBack: () -> Unit,
    onMyGyms: () -> Unit,
) {
    val ticket by viewModel.ticket.collectAsStateWithLifecycle()
    val activeGymId by viewModel.activeGymId.collectAsStateWithLifecycle()
    val gyms by viewModel.gyms.collectAsStateWithLifecycle()
    val token = ticket?.token
    val clipboard = LocalClipboardManager.current
    val seconds = ticket?.secondsRemaining(viewModel.nowMillis) ?: 0
    val gymName = gyms.firstOrNull { it.id == (ticket?.gymId ?: activeGymId) }?.name
        ?: activeGymId?.takeIf { it.isNotBlank() }?.let { "Gimnasio activo" }
        ?: "Sin gimnasio vinculado"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "Mi pase QR", style = MaterialTheme.typography.displaySmall, color = Volt)
        Text(
            text = "Muestra este código en el torniquete. Se renueva automáticamente.",
            style = MaterialTheme.typography.bodyMedium,
            color = Muted,
        )
        Text(
            text = "Gimnasio: $gymName",
            style = MaterialTheme.typography.labelLarge,
            color = if (activeGymId.isNullOrBlank()) Ignition else Emerald,
        )

        val bitmap = remember(token) { token?.let(::generateQrBitmap) }
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Código QR de acceso",
                modifier = Modifier
                    .size(260.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White),
            )
        } else {
            Box(
                modifier = Modifier
                    .size(260.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(SurfaceRaised),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "Generando pase…", color = Ink)
            }
        }

        if (ticket?.offline == true) {
            Text(
                text = "SIN CONEXIÓN · pase firmado guardado",
                style = MaterialTheme.typography.labelLarge,
                color = Volt,
            )
            Text(
                text = "Válido unos $seconds segundos más",
                style = MaterialTheme.typography.bodySmall,
                color = Muted,
            )
        } else {
            Text(
                text = "EN LÍNEA · pase dinámico",
                style = MaterialTheme.typography.labelLarge,
                color = Emerald,
            )
            Text(
                text = "Se renueva en $seconds s",
                style = MaterialTheme.typography.titleMedium,
                color = Ink,
            )
        }

        viewModel.message?.let {
            Text(text = it, style = MaterialTheme.typography.bodySmall, color = Ignition)
        }

        LudusButton(
            text = "Actualizar pase",
            onClick = { viewModel.refresh() },
            variant = LudusButtonVariant.SECONDARY,
            loading = viewModel.isRefreshing,
        )
        LudusButton(
            text = if (viewModel.copied) "Código copiado" else "Copiar código",
            onClick = {
                if (token != null) {
                    clipboard.setText(AnnotatedString(token))
                    viewModel.onCopied()
                }
            },
            variant = LudusButtonVariant.GHOST,
            enabled = !token.isNullOrBlank(),
        )
        LudusButton(text = "Mis gimnasios", onClick = onMyGyms, variant = LudusButtonVariant.GHOST)
        LudusButton(text = "Volver", onClick = onBack, variant = LudusButtonVariant.GHOST)
    }
}

private fun generateQrBitmap(value: String, size: Int = 512): Bitmap? = runCatching {
    val hints = mapOf<EncodeHintType, Any>(
        EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
        EncodeHintType.MARGIN to 2,
    )
    val matrix = QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, size, size, hints)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val dark = AndroidColor.rgb(13, 15, 18)
    for (x in 0 until size) {
        for (y in 0 until size) {
            bitmap.setPixel(x, y, if (matrix[x, y]) dark else AndroidColor.WHITE)
        }
    }
    bitmap
}.getOrNull()
