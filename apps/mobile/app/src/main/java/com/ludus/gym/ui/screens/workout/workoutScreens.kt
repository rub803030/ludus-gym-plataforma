package com.ludus.gym.ui.screens.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ludus.gym.domain.model.weightLabel
import com.ludus.gym.ui.components.EmptyState
import com.ludus.gym.ui.components.LudusButton
import com.ludus.gym.ui.components.LudusButtonVariant
import com.ludus.gym.ui.components.LudusCard
import com.ludus.gym.ui.components.LudusScreenHeader
import com.ludus.gym.ui.components.StatusPill
import com.ludus.gym.ui.theme.Canvas
import com.ludus.gym.ui.theme.Emerald
import com.ludus.gym.ui.theme.Ignition
import com.ludus.gym.ui.theme.Ink
import com.ludus.gym.ui.theme.Muted
import com.ludus.gym.ui.theme.SurfaceRaised
import com.ludus.gym.ui.theme.Volt
import kotlinx.coroutines.delay

private val DAY_LABELS = listOf("L", "M", "X", "J", "V", "S", "D")

@Composable
fun WorkoutScreen(
    viewModel: WorkoutViewModel,
    onBack: () -> Unit,
) {
    val routines by viewModel.routines.collectAsStateWithLifecycle()
    val pendingCount by viewModel.pendingCount.collectAsStateWithLifecycle()
    val routine = routines.firstOrNull { it.dayOfWeek == viewModel.selectedDay }
    val message = viewModel.message

    if (message != null) {
        LaunchedEffect(message) {
            delay(4_500)
            viewModel.consumeMessage()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        LudusScreenHeader(
            title = "Entrenamiento",
            subtitle = "Tu rutina semanal",
            onBack = onBack,
            action = "Actualizar",
            onAction = { viewModel.refresh() },
        )

        if (pendingCount > 0) {
            StatusPill(text = "$pendingCount por sincronizar", color = Volt)
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            DAY_LABELS.forEachIndexed { index, label ->
                val day = index + 1
                val active = day == viewModel.selectedDay
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (active) Volt else SurfaceRaised)
                        .clickable { viewModel.selectDay(day) }
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = label,
                        color = if (active) Canvas else Ink,
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
        }

        if (routine == null) {
            EmptyState(
                title = "Sin rutina este día",
                message = "Toca Actualizar para cargar tu plan de entrenamiento.",
            )
        } else {
            LudusCard {
                Text(routine.title, style = MaterialTheme.typography.titleLarge, color = Ink)
                Text(
                    text = "${routine.durationMinutes} min · ${routine.exercises.size} ejercicios",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Muted,
                )
            }

            routine.exercises.forEach { exercise ->
                LudusCard(onClick = { viewModel.selectExercise(exercise) }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(exercise.name, style = MaterialTheme.typography.titleMedium, color = Ink)
                            Text(
                                text = "${exercise.sets} × ${exercise.reps} · ${exercise.weightKg.weightLabel()} · RPE ${exercise.rpe}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Muted,
                            )
                        }
                        StatusPill(
                            text = exercise.muscleGroup.ifBlank { "General" },
                            color = Emerald,
                        )
                    }
                }
            }

            val selected = viewModel.selectedExercise
            if (selected != null) {
                LudusCard {
                    Text("Registrar serie", style = MaterialTheme.typography.titleMedium, color = Volt)
                    Text(selected.name, style = MaterialTheme.typography.bodyMedium, color = Ink)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = viewModel.setsInput,
                            onValueChange = viewModel::onSetsChange,
                            label = { Text("Series") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = viewModel.repsInput,
                            onValueChange = viewModel::onRepsChange,
                            label = { Text("Reps") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = viewModel.weightInput,
                            onValueChange = viewModel::onWeightChange,
                            label = { Text("Peso") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = "Intensidad (RPE): ${viewModel.rpe}",
                        style = MaterialTheme.typography.labelLarge,
                        color = Ink,
                    )
                    Slider(
                        value = viewModel.rpe.toFloat(),
                        onValueChange = { viewModel.onRpeChange(it.toInt()) },
                        valueRange = 1f..10f,
                        steps = 8,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    LudusButton(
                        text = if (viewModel.isLogging) "Guardando…" else "Guardar serie",
                        onClick = { viewModel.logSet() },
                        loading = viewModel.isLogging,
                    )
                }
            }
        }

        if (message != null) {
            Text(message, style = MaterialTheme.typography.bodyMedium, color = Ignition)
        }

        Spacer(Modifier.height(8.dp))
        LudusButton(text = "Volver", onClick = onBack, variant = LudusButtonVariant.GHOST)
    }
}
