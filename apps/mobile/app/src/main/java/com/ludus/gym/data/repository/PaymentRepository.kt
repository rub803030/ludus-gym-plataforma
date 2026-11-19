package com.ludus.gym.data.repository

import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.domain.model.Receipt
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class PaymentRepository(private val api: ApiService) {
    private val _receipts = MutableStateFlow(DemoCatalog.receipts)
    val receipts: StateFlow<List<Receipt>> = _receipts.asStateFlow()

    suspend fun refresh(): Result<List<Receipt>> = runCatching {
        val remote = api.payments().mapIndexed { index, dto -> dto.toDomain(index) }
        val result = if (remote.isEmpty()) DemoCatalog.receipts else remote
        _receipts.value = result
        result
    }.recoverCatching { DemoCatalog.receipts.also { _receipts.value = it } }
}
