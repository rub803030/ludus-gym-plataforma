package com.ludus.gym.data.repository

import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.dto.RegisterGymRequestDto
import com.ludus.gym.data.remote.dto.toDomain
import com.ludus.gym.domain.model.GymRegistrationResult
import com.ludus.gym.domain.model.RegisterGymInput

/** Alta pública de gimnasio: no necesita sesión ni contexto de gimnasio. */
class GymRegistrationRepository(private val api: ApiService) {
    suspend fun register(input: RegisterGymInput): Result<GymRegistrationResult> = runCatching {
        api.registerGym(
            RegisterGymRequestDto(
                gymName = input.gymName.trim(),
                slug = optional(input.slug),
                ownerName = input.ownerName.trim(),
                email = input.email.trim().lowercase(),
                password = input.password,
                contactEmail = input.contactEmail.trim().lowercase(),
                phone = input.phone.trim(),
                address = input.address.trim(),
                city = input.city.trim(),
                state = input.state.trim(),
                postalCode = input.postalCode.trim(),
                legalRepresentative = input.legalRepresentative.trim(),
                rfc = input.rfc.trim().uppercase(),
                website = optional(input.website),
                socialMedia = optional(input.socialMedia),
                description = optional(input.description),
                branchCount = optionalInt(input.branchCount),
                timezone = optional(input.timezone),
                capacity = optionalInt(input.capacity),
                currency = input.currency.trim().ifBlank { "MXN" }.uppercase(),
                openingHours = optional(input.openingHours),
            ),
        ).toDomain()
    }

    private fun optional(value: String): String? = value.trim().takeIf { it.isNotBlank() }

    private fun optionalInt(value: String): Int? = optional(value)?.toIntOrNull()
}
