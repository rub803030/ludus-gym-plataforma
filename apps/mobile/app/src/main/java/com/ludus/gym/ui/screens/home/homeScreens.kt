package com.ludus.gym.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.LocalDining
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
import com.ludus.gym.ui.theme.SurfaceRaised
import com.ludus.gym.ui.theme.Volt

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    fallbackName: String = "",
    onQr: () -> Unit,
    onWorkout: () -> Unit,
    onNutrition: () -> Unit,
    onBookings: () -> Unit,
    onLinkGym: () -> Unit,
    onMyGyms: () -> Unit,
    onExit: () -> Unit,
) {
    val profile by viewModel.member.collectAsStateWithLifecycle()
    val activeGymId by viewModel.activeGymId.collectAsStateWithLifecycle()
    val gyms by viewModel.gyms.collectAsStateWithLifecycle()
    val member = profile ?: viewModel.fallbackMember
    val name = member?.name?.takeIf { it.isNotBlank() } ?: fallbackName
    val isActive = member?.isActive == true
    val occupancy = viewModel.occupancy
    val activeGymName = gyms.firstOrNull { it.id == activeGymId }?.name
        ?: member?.activeGymId?.takeIf { it == activeGymId }?.let { "Gimnasio activo" }
        ?: "Sin gimnasio vinculado"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        LudusScreenHeader(
            title = "Ludus.",
            subtitle = "Panel del socio",
            action = "Actualizar",
            onAction = { viewModel.refresh() },
        )

        LudusCard {
            Text("Hola, $name", style = MaterialTheme.typography.headlineSmall, color = Ink)
            Text(member?.planName ?: "Ludus Pro", style = MaterialTheme.typography.bodyMedium, color = Muted)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusPill(
                    text = if (isActive) "Membresía activa" else "Membresía pendiente",
                    color = if (isActive) Emerald else Ignition,
                )
                StatusPill(text = "${member?.daysRemaining ?: 0} días", color = Volt)
            }
            Spacer(Modifier.height(10.dp))
            StatusPill(
                text = if (activeGymId.isNullOrBlank()) activeGymName else "Gimnasio: $activeGymName",
                color = if (activeGymId.isNullOrBlank()) Ignition else Emerald,
            )
        }

        LudusCard {
            SectionHeader(title = "Aforo en vivo")
            Text(
                text = "${occupancy.current} de ${occupancy.capacity} personas",
                style = MaterialTheme.typography.titleMedium,
                color = Ink,
            )
            Text(
                text = occupancy.updatedAt.ifBlank { "Actualizado ahora" },
                style = MaterialTheme.typography.bodySmall,
                color = Muted,
            )
            Spacer(Modifier.height(10.dp))
            val fraction = occupancy.ratio.coerceIn(0f, 1f)
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(100.dp))
                    .background(SurfaceRaised),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(fraction = fraction)
                        .height(8.dp)
                        .clip(RoundedCornerShape(100.dp))
                        .background(if (fraction > 0.85f) Ignition else Emerald),
                )
            }
        }

        SectionHeader(title = "Acciones rápidas")
        LudusButton(text = "Mi pase QR", onClick = onQr, leadingIcon = Icons.Filled.QrCode)
        LudusButton(
            text = "Mi rutina",
            onClick = onWorkout,
            variant = LudusButtonVariant.SECONDARY,
            leadingIcon = Icons.Filled.FitnessCenter,
        )
        LudusButton(
            text = "Nutrición",
            onClick = onNutrition,
            variant = LudusButtonVariant.SECONDARY,
            leadingIcon = Icons.Filled.LocalDining,
        )
        LudusButton(
            text = "Reservas",
            onClick = onBookings,
            variant = LudusButtonVariant.SECONDARY,
            leadingIcon = Icons.Filled.CalendarMonth,
        )
        LudusButton(
            text = if (activeGymId.isNullOrBlank()) "Vincular gimnasio" else "Mis gimnasios",
            onClick = if (activeGymId.isNullOrBlank()) onLinkGym else onMyGyms,
            variant = LudusButtonVariant.SECONDARY,
        )
        LudusButton(
            text = "Cerrar sesión",
            onClick = { viewModel.signOut(onExit) },
            variant = LudusButtonVariant.GHOST,
            leadingIcon = Icons.AutoMirrored.Filled.Logout,
        )
    }
}
