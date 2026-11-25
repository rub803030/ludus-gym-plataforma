package com.ludus.gym.ui.screens.gym

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.data.remote.ApiErrorMessages
import com.ludus.gym.domain.model.MyGyms
import com.ludus.gym.domain.usecase.ObserveActiveGymUseCase
import com.ludus.gym.domain.usecase.ObserveGymsUseCase
import com.ludus.gym.domain.usecase.RefreshMyGymsUseCase
import com.ludus.gym.domain.usecase.SwitchGymUseCase
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MyGymsViewModel(
    observeGyms: ObserveGymsUseCase,
    observeActiveGym: ObserveActiveGymUseCase,
    private val refreshMyGyms: RefreshMyGymsUseCase,
    private val switchGym: SwitchGymUseCase,
) : ViewModel() {

    val gyms = observeGyms().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val activeGymId = observeActiveGym().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    var isLoading by mutableStateOf(false)
        private set
    var switchingGymId by mutableStateOf<String?>(null)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var result by mutableStateOf<MyGyms?>(null)
        private set

    init {
        refresh()
    }

    fun refresh() {
        if (isLoading) return
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            refreshMyGyms().fold(
                onSuccess = { result = it },
                onFailure = { errorMessage = ApiErrorMessages.readable(it) },
            )
            isLoading = false
        }
    }

    fun switch(gymId: String) {
        if (switchingGymId != null) return
        viewModelScope.launch {
            switchingGymId = gymId
            errorMessage = null
            message = null
            switchGym(gymId).fold(
                onSuccess = { message = "Gimnasio activo: ${it.gym.name}. Tokens actualizados." },
                onFailure = { errorMessage = ApiErrorMessages.readable(it) },
            )
            switchingGymId = null
        }
    }
}
