package com.ludus.gym.data.remote.dto

import com.ludus.gym.domain.model.Meal
import com.ludus.gym.domain.model.NutritionPlan
import com.squareup.moshi.Json

data class MealDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "title") val title: String? = null,
    @Json(name = "time") val time: String? = null,
    @Json(name = "calories") val calories: Int? = null,
    @Json(name = "proteinG") val proteinG: Int? = null,
    @Json(name = "protein") val protein: Int? = null,
    @Json(name = "carbsG") val carbsG: Int? = null,
    @Json(name = "carbs") val carbs: Int? = null,
    @Json(name = "fatG") val fatG: Int? = null,
    @Json(name = "fat") val fat: Int? = null,
    @Json(name = "foods") val foods: List<String>? = null,
) {
    fun toDomain(index: Int) = Meal(
        id = id ?: "meal-$index",
        name = name ?: title ?: "Comida $index",
        time = time.orEmpty(),
        calories = calories ?: 0,
        proteinG = proteinG ?: protein ?: 0,
        carbsG = carbsG ?: carbs ?: 0,
        fatG = fatG ?: fat ?: 0,
        foods = foods ?: emptyList(),
    )
}

data class NutritionPlanDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "title") val title: String? = null,
    @Json(name = "calories") val calories: Int? = null,
    @Json(name = "proteinG") val proteinG: Int? = null,
    @Json(name = "protein") val protein: Int? = null,
    @Json(name = "carbsG") val carbsG: Int? = null,
    @Json(name = "carbs") val carbs: Int? = null,
    @Json(name = "fatG") val fatG: Int? = null,
    @Json(name = "fat") val fat: Int? = null,
    @Json(name = "hydrationMl") val hydrationMl: Int? = null,
    @Json(name = "meals") val meals: List<MealDto>? = null,
) {
    fun toDomain(): NutritionPlan = NutritionPlan(
        id = id ?: "nutrition-demo",
        title = title ?: "Plan de nutrición",
        calories = calories ?: 2400,
        proteinG = proteinG ?: protein ?: 180,
        carbsG = carbsG ?: carbs ?: 250,
        fatG = fatG ?: fat ?: 70,
        hydrationMl = hydrationMl ?: 2500,
        meals = (meals ?: emptyList()).mapIndexed { i, it -> it.toDomain(i) },
    )
}
