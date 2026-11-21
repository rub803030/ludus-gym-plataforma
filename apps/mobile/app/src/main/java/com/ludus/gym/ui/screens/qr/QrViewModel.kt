package com.ludus.gym.ui.screens.qr

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.domain.usecase.GetQrUseCase
import com.ludus.gym.domain.usecase.ObserveQrUseCase
import com.ludus.gym.domain.usecase.RecordAccessUseCase
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class QrViewModel(
    observeQr: ObserveQrUseCase,
    private val getQr: GetQrUseCase,
    private val recordAccess: RecordAccessUseCase,
) : ViewModel() {

    val ticket = observeQr().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    var nowMillis by mutableStateOf(System.currentTimeMillis())
        private set
    var isRefreshing by mutableStateOf(false)
        private set
    var copied by mutableStateOf(false)
        private set
    var message by mutableStateOf<String?>(null)
        private set

    init {
        viewModelScope.launch {
            refresh()
            while (true) {
                delay(1_000L)
                nowMillis = System.currentTimeMillis()
                if (ticket.value?.isExpired(nowMillis) != false) refresh()
            }
        }
    }

    fun refresh() {
        if (isRefreshing) return
        viewModelScope.launch {
            isRefreshing = true
            getQr()
                .onSuccess { message = null }
                .onFailure {
                    message = "Sin conexión: se muestra el último pase offline guardado."
                }
            isRefreshing = false
        }
    }

    fun onCopied() {
        copied = true
        ticket.value?.let { viewModelScope.launch { recordAccess(it.token) } }
    }

    fun consumeMessage() {
        message = null
        copied = false
    }

    fun isValidForDisplay(payload: String): Boolean {
        val current = ticket.value ?: return false
        return payload == current.token && !current.isExpired(nowMillis)
    }
}
