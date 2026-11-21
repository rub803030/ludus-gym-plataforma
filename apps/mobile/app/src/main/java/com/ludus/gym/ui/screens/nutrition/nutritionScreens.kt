package com.ludus.gym.ui.screens.nutrition

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ludus.gym.ui.components.LudusButton
import com.ludus.gym.ui.components.LudusButtonVariant
import com.ludus.gym.ui.components.LudusCard
import com.ludus.gym.ui.components.LoadingSkeleton
import com.ludus.gym.ui.components.LudusScreenHeader
import com.ludus.gym.ui.components.SectionHeader
import com.ludus.gym.ui.components.StatusPill
import com.ludus.gym.ui.theme.Emerald
import com.ludus.gym.ui.theme.Ink
import com.ludus.gym.ui.theme.Muted
import com.ludus.gym.ui.theme.SurfaceRaised
import com.ludus.gym.ui.theme.Volt

private const val ML_PER_GLASS = 250

@Composable
fun NutritionScreen(
    viewModel: NutritionViewModel,
    onBack: () -> Unit,
) {
    val plan by viewModel.plan.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        LudusScreenHeader(
            title = "Nutrición",
            subtitle = "Plan y seguimiento diario",
            onBack = onBack,
            action = "Actualizar",
            onAction = { viewModel.refresh() },
        )

        if (plan == null) {
            repeat(3) { LoadingSkeleton(height = 96.dp) }
        } else {
            val nutrition = requireNotNull(plan)
            LudusCard {
                Text(nutrition.title, style = MaterialTheme.typography.titleMedium, color = Ink)
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MacroCard("kcal", nutrition.calories.toString(), Volt, Modifier.weight(1f))
                    MacroCard("Proteína", "${nutrition.proteinG} g", Emerald, Modifier.weight(1f))
                    MacroCard("Carbos", "${nutrition.carbsG} g", Ink, Modifier.weight(1f))
                    MacroCard("Grasa", "${nutrition.fatG} g", Muted, Modifier.weight(1f))
                }
            }

            val glasses = viewModel.hydrationGlasses
            val consumedMl = glasses * ML_PER_GLASS
            val progress = (consumedMl.toFloat() / nutrition.hydrationMl.coerceAtLeast(1)).coerceIn(0f, 1f)

            LudusCard {
                Text("Hidratación", style = MaterialTheme.typography.titleMedium, color = Ink)
                Text(
                    text = "$glasses vasos · $consumedMl de ${nutrition.hydrationMl} ml",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Muted,
                )
                Spacer(Modifier.height(10.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(100.dp))
                        .background(SurfaceRaised),
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(fraction = progress)
                            .height(8.dp)
                            .clip(RoundedCornerShape(100.dp))
                            .background(Emerald),
                    )
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LudusButton(
                        text = "Quitar vaso",
                        onClick = { viewModel.removeGlass() },
                        enabled = glasses > 0,
                        variant = LudusButtonVariant.GHOST,
                        modifier = Modifier.weight(1f),
                    )
                    LudusButton(
                        text = "Añadir vaso",
                        onClick = { viewModel.addGlass() },
                        variant = LudusButtonVariant.SECONDARY,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            SectionHeader(title = "Comidas del día")
            nutrition.meals.forEach { meal ->
                LudusCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        StatusPill(text = meal.time, color = Volt)
                        Spacer(Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(meal.name, style = MaterialTheme.typography.titleMedium, color = Ink)
                            Text(
                                text = meal.foods.joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = Muted,
                            )
                        }
                        Text(
                            text = "${meal.calories} kcal",
                            style = MaterialTheme.typography.labelLarge,
                            color = Emerald,
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "P ${meal.proteinG} g · C ${meal.carbsG} g · G ${meal.fatG} g",
                        style = MaterialTheme.typography.bodySmall,
                        color = Muted,
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        LudusButton(text = "Volver", onClick = onBack, variant = LudusButtonVariant.GHOST)
    }
}

@Composable
private fun MacroCard(
    label: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(SurfaceRaised)
            .padding(vertical = 12.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, style = MaterialTheme.typography.titleMedium, color = color)
        Text(label, style = MaterialTheme.typography.labelSmall, color = Muted)
    }
}
