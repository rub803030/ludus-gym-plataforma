package com.ludus.gym.data.demo

import com.ludus.gym.domain.model.Exercise
import com.ludus.gym.domain.model.GymClass
import com.ludus.gym.domain.model.Meal
import com.ludus.gym.domain.model.Member
import com.ludus.gym.domain.model.MembershipStatus
import com.ludus.gym.domain.model.NutritionPlan
import com.ludus.gym.domain.model.Occupancy
import com.ludus.gym.domain.model.Receipt
import com.ludus.gym.domain.model.Routine

/**
 * Contenido de demostración. Se usa solo cuando el backend no responde o sus
 * endpoints opcionales aún no existen, para que la app nunca quede vacía.
 */
object DemoCatalog {
    const val DEMO_EMAIL = "socio@ludusgym.com"
    const val DEMO_PASSWORD = "Ludus2026!"

    val member = Member(
        id = "member-demo",
        name = "Ruben Polanco",
        email = DEMO_EMAIL,
        membershipStatus = MembershipStatus.ACTIVE,
        planName = "Ludus Pro",
        daysRemaining = 24,
    )

    val occupancy = Occupancy(current = 38, capacity = 60, updatedAt = "hace 2 min")

    private fun ex(id: String, name: String, sets: Int, reps: Int, kg: Double, group: String) =
        Exercise(id, name, sets, reps, kg, 7, group)

    val routines: List<Routine> = listOf(
        Routine(
            id = "routine-lunes",
            dayOfWeek = 1,
            title = "Fuerza · Pecho y tríceps",
            durationMinutes = 65,
            exercises = listOf(
                ex("press-banca", "Press banca", 4, 8, 62.5, "Pecho"),
                ex("inclinado", "Press inclinado mancuernas", 3, 10, 24.0, "Pecho"),
                ex("fondos", "Fondos en paralelas", 3, 12, 0.0, "Tríceps"),
                ex("curl-barra", "Curl de bíceps con barra", 3, 12, 20.0, "Bíceps"),
            ),
        ),
        Routine(
            id = "routine-martes",
            dayOfWeek = 2,
            title = "Hyrox · Motor y core",
            durationMinutes = 55,
            exercises = listOf(
                ex("ski-erg", "Ski Erg", 4, 20, 0.0, "Cardio"),
                ex("sled-push", "Empuje de trineo", 4, 12, 40.0, "Pierna"),
                ex("burpees", "Burpees", 3, 15, 0.0, "Core"),
                ex("plancha", "Plancha", 3, 45, 0.0, "Core"),
            ),
        ),
        Routine(
            id = "routine-miercoles",
            dayOfWeek = 3,
            title = "Espalda y hombro",
            durationMinutes = 60,
            exercises = listOf(
                ex("dominadas", "Dominadas", 4, 8, 0.0, "Espalda"),
                ex("remo", "Remo con barra", 4, 10, 50.0, "Espalda"),
                ex("militar", "Press militar", 3, 10, 30.0, "Hombro"),
                ex("face-pull", "Face pull", 3, 15, 18.0, "Hombro"),
            ),
        ),
        Routine(
            id = "routine-jueves",
            dayOfWeek = 4,
            title = "Pierna · Fuerza",
            durationMinutes = 70,
            exercises = listOf(
                ex("sentadilla", "Sentadilla trasera", 4, 8, 90.0, "Cuádriceps"),
                ex("peso-muerto", "Peso muerto", 4, 6, 110.0, "Glúteo"),
                ex("zancadas", "Zancadas", 3, 12, 20.0, "Pierna"),
                ex("gemelos", "Elevación de gemelos", 3, 20, 40.0, "Gemelos"),
            ),
        ),
        Routine(
            id = "routine-viernes",
            dayOfWeek = 5,
            title = "Full body · Circuitos",
            durationMinutes = 50,
            exercises = listOf(
                ex("kettlebell", "Swings de kettlebell", 4, 20, 24.0, "Glúteo"),
                ex("remo-mancuerna", "Remo con mancuerna", 3, 12, 26.0, "Espalda"),
                ex("press-mancuerna", "Press mancuerna sentado", 3, 12, 22.0, "Hombro"),
                ex("wall-ball", "Wall ball", 3, 20, 9.0, "Cardio"),
            ),
        ),
        Routine(
            id = "routine-sabado",
            dayOfWeek = 6,
            title = "Hyrox · Resistencia",
            durationMinutes = 60,
            exercises = listOf(
                ex("row", "Remo ergómetro", 4, 500, 0.0, "Cardio"),
                ex("sandbag", "Sandbag carry", 4, 40, 30.0, "Core"),
                ex("farmers", "Farmers carry", 3, 30, 32.0, "Agarre"),
                ex("squat-jump", "Salto con sentadilla", 3, 15, 0.0, "Pierna"),
            ),
        ),
        Routine(
            id = "routine-domingo",
            dayOfWeek = 7,
            title = "Movilidad y recuperación",
            durationMinutes = 40,
            exercises = listOf(
                ex("movilidad-cadera", "Movilidad de cadera", 3, 12, 0.0, "Movilidad"),
                ex("thoracic", "Rotación torácica", 3, 12, 0.0, "Movilidad"),
                ex("estiramiento", "Estiramiento global", 3, 60, 0.0, "Recuperación"),
            ),
        ),
    )

    val nutritionPlan = NutritionPlan(
        id = "nutrition-demo",
        title = "Plan rendimiento · Día de entrenamiento",
        calories = 2450,
        proteinG = 190,
        carbsG = 265,
        fatG = 72,
        hydrationMl = 2800,
        meals = listOf(
            Meal("desayuno", "Desayuno", "08:00", 520, 38, 58, 14, listOf("Avena", "Huevos", "Frutos rojos")),
            Meal("comida", "Comida", "13:30", 780, 55, 88, 22, listOf("Arroz", "Pollo", "Verduras")),
            Meal("pre-entreno", "Pre-entreno", "17:30", 320, 28, 42, 8, listOf("Plátano", "Yogur griego")),
            Meal("cena", "Cena", "21:00", 680, 48, 62, 24, listOf("Salmón", "Patata", "Ensalada")),
            Meal("snack", "Snack", "22:30", 150, 21, 15, 4, listOf("Proteína", "Frutos secos")),
        ),
    )

    val classes: List<GymClass> = listOf(
        GymClass("hyrox-am", "Hyrox · Engine", "Hoy · 07:00", 60, "Lucía M.", 16, 11, false, "Alta"),
        GymClass("hyrox-pm", "Hyrox · Race Simulation", "Hoy · 18:30", 75, "Dani R.", 16, 14, false, "Muy alta"),
        GymClass("hyrox-sab", "Hyrox · Sled & Ski", "Sábado · 10:00", 60, "Iván P.", 14, 6, false, "Alta"),
        GymClass("hyrox-dom", "Hyrox · Recovery Run", "Domingo · 09:30", 45, "Sara G.", 20, 9, false, "Baja"),
    )

    val receipts: List<Receipt> = listOf(
        Receipt("pay-2026-11", "Membresía Ludus Pro · Noviembre", 59.90, "01/11/2026", "Pagado"),
        Receipt("pay-2026-10", "Membresía Ludus Pro · Octubre", 59.90, "01/10/2026", "Pagado"),
        Receipt("pay-2026-09", "Membresía Ludus Pro · Septiembre", 59.90, "01/09/2026", "Pagado"),
    )
}
