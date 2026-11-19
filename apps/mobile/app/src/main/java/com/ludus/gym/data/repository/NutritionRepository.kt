package com.ludus.gym.data.repository

import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.domain.model.NutritionPlan
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class NutritionRepository(private val api: ApiService) {
    private val _plan = MutableStateFlow<NutritionPlan>(DemoCatalog.nutritionPlan)
    val plan: StateFlow<NutritionPlan> = _plan.asStateFlow()

    suspend fun refresh(): Result<NutritionPlan> = runCatching {
        val remote = api.nutritionPlans().firstOrNull()?.toDomain() ?: DemoCatalog.nutritionPlan
        val plan = if (remote.meals.isEmpty()) DemoCatalog.nutritionPlan else remote
        _plan.value = plan
        plan
    }.recoverCatching { DemoCatalog.nutritionPlan.also { _plan.value = it } }
}
