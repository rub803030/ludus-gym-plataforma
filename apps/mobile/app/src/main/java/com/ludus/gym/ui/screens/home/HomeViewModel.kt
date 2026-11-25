package com.ludus.gym.ui.screens.home

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.domain.model.Member
import com.ludus.gym.domain.model.Occupancy
import com.ludus.gym.domain.usecase.GetCachedProfileUseCase
import com.ludus.gym.domain.usecase.ObserveActiveGymUseCase
import com.ludus.gym.domain.usecase.ObserveGymsUseCase
import com.ludus.gym.domain.usecase.GetOccupancyUseCase
import com.ludus.gym.domain.usecase.GetProfileUseCase
import com.ludus.gym.domain.usecase.LogoutUseCase
import com.ludus.gym.domain.usecase.ObserveProfileUseCase
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class HomeViewModel(
    observeProfile: ObserveProfileUseCase,
    observeActiveGym: ObserveActiveGymUseCase,
    observeGyms: ObserveGymsUseCase,
    private val getCachedProfile: GetCachedProfileUseCase,
    private val getProfile: GetProfileUseCase,
    private val getOccupancy: GetOccupancyUseCase,
    private val logout: LogoutUseCase,
    private val memberId: String?,
) : ViewModel() {

    val member = observeProfile().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val activeGymId = observeActiveGym().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val gyms = observeGyms().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    var fallbackMember by mutableStateOf<Member?>(null)
        private set
    var occupancy by mutableStateOf(DemoCatalog.occupancy)
        private set
    var refreshing by mutableStateOf(false)
        private set

    init { refresh() }

    fun refresh() {
        if (refreshing) return
        viewModelScope.launch {
            refreshing = true
            fallbackMember = getCachedProfile(memberId)
            getProfile().onSuccess { fallbackMember = it }
            occupancy = getOccupancy().getOrDefault(DemoCatalog.occupancy)
            refreshing = false
        }
    }

    fun signOut(onDone: () -> Unit) {
        viewModelScope.launch {
            logout()
            onDone()
        }
    }
}
