package com.ludus.gym.ui.screens.qr

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.domain.usecase.GetQrUseCase
import com.ludus.gym.domain.usecase.ObserveQrUseCase
import com.ludus.gym.domain.usecase.RecordAccessUseCase
import com.ludus.gym.domain.usecase.VerifyQrLocallyUseCase
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class QrViewModel(
    observeQr: ObserveQrUseCase,
    private val getQr: GetQrUseCase,
    private val verifyLocally: VerifyQrLocallyUseCase,
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
                val current = ticket.value
                val expired = current?.isExpired(nowMillis) ?: true
                val needsRotation = current?.offline == true &&
                    (nowMillis - lastIssuedAt) >= 30_000L
                if (expired || needsRotation) refresh()
            }
        }
    }

    private var lastIssuedAt: Long = 0L

    fun refresh() {
        if (isRefreshing) return
        viewModelScope.launch {
            isRefreshing = true
            getQr()
                .onSuccess { lastIssuedAt = System.currentTimeMillis() }
                .onFailure { message = "No se pudo actualizar el código. Se mantiene la credencial guardada." }
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

    fun isValidForDisplay(payload: String): Boolean = verifyLocally(payload)
}
