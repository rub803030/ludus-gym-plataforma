package com.ludus.gym.ui.screens.bookings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.domain.model.GymClass
import com.ludus.gym.domain.usecase.BookClassUseCase
import com.ludus.gym.domain.usecase.CancelBookingUseCase
import com.ludus.gym.domain.usecase.ObserveClassesUseCase
import com.ludus.gym.domain.usecase.ObserveReceiptsUseCase
import com.ludus.gym.domain.usecase.RefreshClassesUseCase
import com.ludus.gym.domain.usecase.RefreshReceiptsUseCase
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class BookingViewModel(
    observeClasses: ObserveClassesUseCase,
    observeReceipts: ObserveReceiptsUseCase,
    private val refreshClasses: RefreshClassesUseCase,
    private val refreshReceipts: RefreshReceiptsUseCase,
    private val bookClass: BookClassUseCase,
    private val cancelBooking: CancelBookingUseCase,
) : ViewModel() {

    val classes = observeClasses().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val receipts = observeReceipts().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    var confirmationFor by mutableStateOf<GymClass?>(null)
        private set
    var busyClassId by mutableStateOf<String?>(null)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var showReceipts by mutableStateOf(false)
        private set

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            refreshClasses()
            refreshReceipts()
        }
    }

    fun requestBook(item: GymClass) { confirmationFor = item }

    fun requestCancel(item: GymClass) { confirmationFor = item }

    fun dismissConfirmation() { confirmationFor = null }

    fun confirm() {
        val item = confirmationFor ?: return
        if (busyClassId != null) return
        val shouldBook = !item.isBooked
        confirmationFor = null
        busyClassId = item.id
        viewModelScope.launch {
            val result = if (shouldBook) bookClass(item.id) else cancelBooking(item.id)
            message = result.fold(
                onSuccess = { if (shouldBook) "Plaza reservada. ¡Nos vemos en clase!" else "Reserva cancelada." },
                onFailure = { "No se pudo completar la operación. Inténtalo de nuevo." },
            )
            busyClassId = null
        }
    }

    fun toggleReceipts() { showReceipts = !showReceipts }

    fun consumeMessage() { message = null }
}
