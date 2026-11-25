package com.ludus.gym.domain.usecase

import com.ludus.gym.data.repository.GymRepository
import com.ludus.gym.domain.model.Gym
import com.ludus.gym.domain.model.JoinResult
import com.ludus.gym.domain.model.MyGyms
import com.ludus.gym.domain.model.SwitchResult
import kotlinx.coroutines.flow.Flow

class ObserveActiveGymUseCase(private val gyms: GymRepository) {
    operator fun invoke() = gyms.activeGymId
}

class ObserveGymsUseCase(private val gyms: GymRepository) {
    operator fun invoke(): Flow<List<Gym>> = gyms.observeGyms()
}

class JoinGymUseCase(private val gyms: GymRepository) {
    suspend operator fun invoke(code: String): Result<JoinResult> = gyms.joinGym(code)
}

class RefreshMyGymsUseCase(private val gyms: GymRepository) {
    suspend operator fun invoke(): Result<MyGyms> = gyms.refreshMyGyms()
}

class SwitchGymUseCase(private val gyms: GymRepository) {
    suspend operator fun invoke(gymId: String): Result<SwitchResult> = gyms.switchGym(gymId)
}
