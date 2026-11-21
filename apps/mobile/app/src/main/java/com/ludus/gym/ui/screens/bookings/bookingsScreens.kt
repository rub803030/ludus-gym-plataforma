package com.ludus.gym.ui.screens.bookings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ludus.gym.ui.components.EmptyState
import com.ludus.gym.ui.components.LudusButton
import com.ludus.gym.ui.components.LudusButtonVariant
import com.ludus.gym.ui.components.LudusCard
import com.ludus.gym.ui.components.LudusScreenHeader
import com.ludus.gym.ui.components.SectionHeader
import com.ludus.gym.ui.components.StatusPill
import com.ludus.gym.ui.theme.Emerald
import com.ludus.gym.ui.theme.Ignition
import com.ludus.gym.ui.theme.Ink
import com.ludus.gym.ui.theme.Muted
import com.ludus.gym.ui.theme.Volt
import kotlinx.coroutines.delay

@Composable
fun BookingsScreen(
    viewModel: BookingViewModel,
    onBack: () -> Unit,
) {
    val classes by viewModel.classes.collectAsStateWithLifecycle()
    val receipts by viewModel.receipts.collectAsStateWithLifecycle()
    val confirmation = viewModel.confirmationFor
    val message = viewModel.message

    if (message != null) {
        LaunchedEffect(message) {
            delay(4_500)
            viewModel.consumeMessage()
        }
    }

    if (confirmation != null) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissConfirmation() },
            title = {
                Text(if (confirmation.isBooked) "Cancelar reserva" else "Reservar plaza")
            },
            text = {
                Text("${confirmation.title} · ${confirmation.startAt}")
            },
            confirmButton = {
                TextButton(onClick = { viewModel.confirm() }) { Text("Confirmar") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissConfirmation() }) { Text("Volver") }
            },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        LudusScreenHeader(
            title = "Reservas",
            subtitle = "Clases y comprobantes",
            onBack = onBack,
            action = "Actualizar",
            onAction = { viewModel.refresh() },
        )

        SectionHeader(title = "Próximas clases")
        if (classes.isEmpty()) {
            EmptyState(
                title = "Sin clases disponibles",
                message = "Toca Actualizar para cargar el horario.",
            )
        } else {
            classes.forEach { item ->
                LudusCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.title, style = MaterialTheme.typography.titleMedium, color = Ink)
                            Text(
                                text = "${item.startAt} · ${item.durationMinutes} min · ${item.coach}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Muted,
                            )
                        }
                        StatusPill(text = item.intensity, color = Ignition)
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "${item.spotsLeft} plazas libres",
                            style = MaterialTheme.typography.labelLarge,
                            color = if (item.isFull) Ignition else Emerald,
                            modifier = Modifier.weight(1f),
                        )
                        if (item.isBooked) StatusPill(text = "Reservada", color = Emerald)
                    }
                    Spacer(Modifier.height(10.dp))
                    LudusButton(
                        text = if (item.isBooked) "Cancelar reserva" else "Reservar plaza",
                        onClick = {
                            if (item.isBooked) viewModel.requestCancel(item) else viewModel.requestBook(item)
                        },
                        enabled = (item.isBooked || !item.isFull) && viewModel.busyClassId == null,
                        loading = viewModel.busyClassId == item.id,
                        variant = if (item.isBooked) LudusButtonVariant.SECONDARY else LudusButtonVariant.PRIMARY,
                    )
                }
            }
        }

        SectionHeader(
            title = "Comprobantes",
            action = if (viewModel.showReceipts) "Ocultar" else "Ver recibos",
            onAction = { viewModel.toggleReceipts() },
        )
        if (viewModel.showReceipts) {
            if (receipts.isEmpty()) {
                EmptyState(title = "Sin comprobantes", message = "Todavía no hay pagos registrados.")
            } else {
                receipts.forEach { receipt ->
                    LudusCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = receipt.concept,
                                style = MaterialTheme.typography.titleMedium,
                                color = Ink,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                text = "${String.format(java.util.Locale("es", "MX"), "%.2f", receipt.amount)} MXN",
                                style = MaterialTheme.typography.labelLarge,
                                color = Emerald,
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "${receipt.date} · ${receipt.status}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Muted,
                        )
                    }
                }
            }
        }

        if (message != null) {
            Text(message, style = MaterialTheme.typography.bodyMedium, color = Volt)
        }

        Spacer(Modifier.height(8.dp))
        LudusButton(text = "Volver", onClick = onBack, variant = LudusButtonVariant.GHOST)
    }
}
