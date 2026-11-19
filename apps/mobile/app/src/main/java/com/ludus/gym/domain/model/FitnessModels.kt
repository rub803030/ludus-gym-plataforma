package com.ludus.gym.domain.model

data class Meal(
    val id: String,
    val name: String,
    val time: String,
    val calories: Int,
    val proteinG: Int,
    val carbsG: Int,
    val fatG: Int,
    val foods: List<String> = emptyList(),
)

data class NutritionPlan(
    val id: String,
    val title: String = "Plan de nutrición",
    val calories: Int = 2400,
    val proteinG: Int = 180,
    val carbsG: Int = 250,
    val fatG: Int = 70,
    val hydrationMl: Int = 2500,
    val meals: List<Meal> = emptyList(),
)

data class GymClass(
    val id: String,
    val title: String,
    val startAt: String,
    val durationMinutes: Int = 60,
    val coach: String = "Equipo Ludus",
    val capacity: Int = 16,
    val booked: Int = 0,
    val isBooked: Boolean = false,
    val intensity: String = "Alta",
) {
    val spotsLeft: Int get() = (capacity - booked).coerceAtLeast(0)
    val isFull: Boolean get() = spotsLeft == 0 && !isBooked
}

data class Receipt(
    val id: String,
    val concept: String,
    val amount: Double,
    val date: String,
    val status: String = "Pagado",
)
