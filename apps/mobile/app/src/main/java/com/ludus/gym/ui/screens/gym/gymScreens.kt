package com.ludus.gym.ui.screens.gym

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.ludus.gym.ui.components.EmptyState
import com.ludus.gym.ui.components.LudusButton
import com.ludus.gym.ui.components.LudusButtonVariant
import com.ludus.gym.ui.components.LudusCard
import com.ludus.gym.ui.components.LudusScreenHeader
import com.ludus.gym.ui.components.StatusPill
import com.ludus.gym.ui.theme.Emerald
import com.ludus.gym.ui.theme.Ignition
import com.ludus.gym.ui.theme.Ink
import com.ludus.gym.ui.theme.Muted
import com.ludus.gym.ui.theme.Volt
import androidx.compose.ui.unit.dp

@Composable
fun LinkGymScreen(
    viewModel: LinkGymViewModel,
    onBack: () -> Unit,
    onScan: () -> Unit,
    onMyGyms: () -> Unit,
    onHome: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        LudusScreenHeader(
            title = "Vincular gimnasio",
            subtitle = "Escribe el código LUDUS-XXXX o escanea el QR del gimnasio",
            onBack = onBack,
        )

        LudusCard {
            OutlinedTextField(
                value = viewModel.code,
                onValueChange = viewModel::onCodeChange,
                label = { Text("Código del gimnasio") },
                placeholder = { Text("LUDUS-A7K2") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            LudusButton(
                text = "Vincularme",
                onClick = { viewModel.submit { onHome() } },
                loading = viewModel.isLoading,
            )
        }

        LudusButton(
            text = "Escanear QR del gimnasio",
            onClick = onScan,
            variant = LudusButtonVariant.SECONDARY,
        )
        LudusButton(
            text = "Mis gimnasios",
            onClick = onMyGyms,
            variant = LudusButtonVariant.SECONDARY,
        )
        LudusButton(text = "Ir al inicio", onClick = onHome, variant = LudusButtonVariant.GHOST)

        viewModel.message?.let { GymStatusText(it, success = true) }
        viewModel.errorMessage?.let { GymStatusText(it) }
    }
}

@Composable
fun MyGymsScreen(
    viewModel: MyGymsViewModel,
    onBack: () -> Unit,
    onLinkGym: () -> Unit,
) {
    val gyms by viewModel.gyms.collectAsStateWithLifecycle()
    val activeGymId by viewModel.activeGymId.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        LudusScreenHeader(
            title = "Mis gimnasios",
            subtitle = "Cambia de gimnasio activo cuando lo necesites",
            onBack = onBack,
            action = if (viewModel.isLoading) "Actualizando…" else "Actualizar",
            onAction = viewModel::refresh,
        )

        if (gyms.isEmpty() && !viewModel.isLoading) {
            EmptyState(
                title = "Todavía no tienes gimnasios",
                message = "Vincula uno con su código o con el QR de inscripción.",
                actionLabel = "Vincular gimnasio",
                onAction = onLinkGym,
            )
        } else {
            gyms.forEach { gym ->
                LudusCard {
                    Text(gym.name, style = MaterialTheme.typography.titleMedium, color = Ink)
                    gym.publicCode?.let { Text("Código: $it", style = MaterialTheme.typography.bodySmall, color = Muted) }
                    Spacer(Modifier.height(8.dp))
                    StatusPill(
                        text = if (gym.id == activeGymId) "Gimnasio activo" else "Disponible",
                        color = if (gym.id == activeGymId) Emerald else Volt,
                    )
                    if (gym.id != activeGymId) {
                        Spacer(Modifier.height(10.dp))
                        LudusButton(
                            text = if (viewModel.switchingGymId == gym.id) "Cambiando…" else "Usar este gimnasio",
                            onClick = { viewModel.switch(gym.id) },
                            variant = LudusButtonVariant.SECONDARY,
                            enabled = viewModel.switchingGymId == null,
                            loading = viewModel.switchingGymId == gym.id,
                        )
                    }
                }
            }
        }

        viewModel.message?.let { GymStatusText(it, success = true) }
        viewModel.errorMessage?.let { GymStatusText(it) }
        LudusButton(text = "Vincular otro gimnasio", onClick = onLinkGym, variant = LudusButtonVariant.GHOST)
    }
}

@OptIn(ExperimentalGetImage::class)
@Composable
fun GymQrScannerScreen(
    onDetected: (String) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val currentOnDetected = rememberUpdatedState(onDetected)
    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasPermission = granted
    }
    var lastRawValue by remember { mutableStateOf<String?>(null) }
    var scanMessage by remember { mutableStateOf("Apunta al QR estático del gimnasio") }
    val bound = remember { mutableStateOf(false) }
    val options = remember {
        BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
    }
    val barcodeScanner = remember { BarcodeScanning.getClient(options) }

    DisposableEffect(barcodeScanner) {
        onDispose { barcodeScanner.close() }
    }
    LaunchedEffect(Unit) {
        if (!hasPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        LudusScreenHeader(
            title = "Escanear QR del gimnasio",
            subtitle = "El código se valida en el servidor antes de vincularte",
            onBack = onBack,
        )

        if (hasPermission) {
            AndroidView(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(320.dp)
                    .clip(RoundedCornerShape(18.dp)),
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                    }
                },
                update = { previewView ->
                    if (bound.value) return@AndroidView
                    val cameraProviderFuture = runCatching { ProcessCameraProvider.getInstance(context) }.getOrNull()
                    if (cameraProviderFuture == null) {
                        scanMessage = "La cámara no está disponible en este dispositivo."
                        return@AndroidView
                    }
                    cameraProviderFuture.addListener({
                        val provider = runCatching { cameraProviderFuture.get() }.getOrNull() ?: return@addListener
                        val preview = Preview.Builder().build().also { camera ->
                            camera.setSurfaceProvider(previewView.surfaceProvider)
                        }
                        val analysis = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()
                        analysis.setAnalyzer(ContextCompat.getMainExecutor(context)) { imageProxy ->
                            val mediaImage = imageProxy.image
                            if (mediaImage == null) {
                                imageProxy.close()
                                return@setAnalyzer
                            }
                            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                            barcodeScanner.process(image)
                                .addOnSuccessListener { barcodes ->
                                    val raw = barcodes.firstOrNull { it.format == Barcode.FORMAT_QR_CODE }?.rawValue
                                    if (!raw.isNullOrBlank() && raw != lastRawValue) {
                                        lastRawValue = raw
                                        scanMessage = "QR leído. Vinculando con el gimnasio…"
                                        currentOnDetected.value(raw)
                                    }
                                }
                                .addOnCompleteListener { imageProxy.close() }
                        }
                        runCatching {
                            provider.unbindAll()
                            provider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                analysis,
                            )
                            bound.value = true
                        }.onFailure {
                            scanMessage = "No pudimos abrir la cámara. Usa el código manual."
                        }
                    }, ContextCompat.getMainExecutor(context))
                },
            )
            GymStatusText(scanMessage, success = lastRawValue != null)
        } else {
            GymStatusText("Necesitamos permiso de cámara para leer el QR.")
            LudusButton(text = "Conceder permiso", onClick = {
                permissionLauncher.launch(Manifest.permission.CAMERA)
            })
        }

        LudusButton(text = "Escribir código manualmente", onClick = onBack, variant = LudusButtonVariant.SECONDARY)
    }
}

@Composable
private fun GymStatusText(
    text: String,
    success: Boolean = false,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = if (success) Emerald else if (text.contains("no ", true) || text.contains("No ", true)) Ignition else Muted,
        modifier = Modifier.padding(top = 4.dp),
    )
}
