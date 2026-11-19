package com.ludus.gym.domain.usecase

import com.ludus.gym.data.repository.NutritionRepository
import com.ludus.gym.data.repository.PaymentRepository
import com.ludus.gym.domain.model.NutritionPlan
import com.ludus.gym.domain.model.Receipt
import kotlinx.coroutines.flow.StateFlow

class ObserveNutritionUseCase(private val nutrition: NutritionRepository) {
    operator fun invoke(): StateFlow<NutritionPlan> = nutrition.plan
}

class RefreshNutritionUseCase(private val nutrition: NutritionRepository) {
    suspend operator fun invoke() = nutrition.refresh()
}

class ObserveReceiptsUseCase(private val payments: PaymentRepository) {
    operator fun invoke(): StateFlow<List<Receipt>> = payments.receipts
}

class RefreshReceiptsUseCase(private val payments: PaymentRepository) {
    suspend operator fun invoke() = payments.refresh()
}
