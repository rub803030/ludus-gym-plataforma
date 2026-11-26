package com.ludus.gym.domain.usecase

import com.ludus.gym.data.repository.GymRegistrationRepository
import com.ludus.gym.data.repository.RegistrationRepository
import com.ludus.gym.domain.model.GymRegistrationResult
import com.ludus.gym.domain.model.RegisterGymInput
import com.ludus.gym.domain.model.RegisterMemberInput
import com.ludus.gym.domain.model.RegistrationResult

class RegisterMemberUseCase(private val registration: RegistrationRepository) {
    suspend operator fun invoke(input: RegisterMemberInput): Result<RegistrationResult> =
        registration.register(input)
}

class RegisterGymUseCase(private val registration: GymRegistrationRepository) {
    suspend operator fun invoke(input: RegisterGymInput): Result<GymRegistrationResult> =
        registration.register(input)
}
