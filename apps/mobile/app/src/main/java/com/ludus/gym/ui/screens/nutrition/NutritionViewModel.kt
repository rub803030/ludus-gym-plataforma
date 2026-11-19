package com.ludus.gym.ui.screens.nutrition

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.domain.usecase.ObserveNutritionUseCase
import com.ludus.gym.domain.usecase.RefreshNutritionUseCase
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class NutritionViewModel(
    observeNutrition: ObserveNutritionUseCase,
    private val refreshNutrition: RefreshNutritionUseCase,
) : ViewModel() {

    val plan = observeNutrition().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    var hydrationGlasses by mutableStateOf(0)
        private set

    init { refresh() }

    fun refresh() {
        viewModelScope.launch { refreshNutrition() }
    }

    fun addGlass() {
        hydrationGlasses = (hydrationGlasses + 1).coerceAtMost(12)
    }

    fun removeGlass() {
        hydrationGlasses = (hydrationGlasses - 1).coerceAtLeast(0)
    }
}
