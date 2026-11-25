package com.ludus.gym.data.repository

import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.dto.RegisterMemberRequestDto
import com.ludus.gym.domain.model.RegisterMemberInput
import com.ludus.gym.domain.model.RegistrationResult

/** Alta pública de socio: no necesita sesión ni contexto de gimnasio. */
class RegistrationRepository(private val api: ApiService) {
    suspend fun register(input: RegisterMemberInput): Result<RegistrationResult> = runCatching {
        val response = api.registerMember(
            RegisterMemberRequestDto(
                firstName = input.firstName.trim(),
                lastName = input.lastName.trim(),
                email = input.email.trim(),
                password = input.password,
                phone = input.phone?.trim()?.takeIf { it.isNotBlank() },
                documentNumber = input.documentNumber?.trim()?.takeIf { it.isNotBlank() },
                birthDate = input.birthDate?.trim()?.takeIf { it.isNotBlank() },
            ),
        )
        val verification = response.verification
        RegistrationResult(
            memberId = response.member?.id.orEmpty(),
            code = response.member?.code,
            email = verification?.email?.takeIf { it.isNotBlank() }
                ?: response.member?.email ?: input.email.trim(),
            expiresAt = verification?.expiresAt,
            devToken = verification?.devToken,
            devLink = verification?.devLink,
        )
    }
}
