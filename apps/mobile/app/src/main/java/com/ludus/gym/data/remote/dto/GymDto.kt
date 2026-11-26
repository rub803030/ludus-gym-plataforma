package com.ludus.gym.data.remote.dto

import com.ludus.gym.domain.model.Gym
import com.ludus.gym.domain.model.GymRegistrationResult
import com.ludus.gym.domain.model.JoinResult
import com.ludus.gym.domain.model.MyGym
import com.ludus.gym.domain.model.MyGyms
import com.ludus.gym.domain.model.SwitchResult
import com.squareup.moshi.Json

data class GymDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "publicCode") val publicCode: String? = null,
    @Json(name = "status") val status: String? = null,
)

data class JoinGymRequestDto(
    @Json(name = "code") val code: String,
)

data class JoinGymResponseDto(
    @Json(name = "gym") val gym: GymDto? = null,
    @Json(name = "activeGymId") val activeGymId: String? = null,
    @Json(name = "alreadyMember") val alreadyMember: Boolean = false,
    @Json(name = "tokens") val tokens: TokenPairDto? = null,
)

data class SwitchGymRequestDto(
    @Json(name = "gymId") val gymId: String,
)

data class SwitchGymResponseDto(
    @Json(name = "gym") val gym: GymDto? = null,
    @Json(name = "activeGymId") val activeGymId: String? = null,
    @Json(name = "tokens") val tokens: TokenPairDto? = null,
)

data class RegisterGymRequestDto(
    @Json(name = "gymName") val gymName: String,
    @Json(name = "slug") val slug: String? = null,
    @Json(name = "ownerName") val ownerName: String,
    @Json(name = "email") val email: String,
    @Json(name = "password") val password: String,
    @Json(name = "contactEmail") val contactEmail: String,
    @Json(name = "phone") val phone: String,
    @Json(name = "address") val address: String,
    @Json(name = "city") val city: String,
    @Json(name = "state") val state: String,
    @Json(name = "postalCode") val postalCode: String,
    @Json(name = "legalRepresentative") val legalRepresentative: String,
    @Json(name = "rfc") val rfc: String,
    @Json(name = "website") val website: String? = null,
    @Json(name = "socialMedia") val socialMedia: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "branchCount") val branchCount: Int? = null,
    @Json(name = "timezone") val timezone: String? = null,
    @Json(name = "capacity") val capacity: Int? = null,
    @Json(name = "currency") val currency: String = "MXN",
    @Json(name = "openingHours") val openingHours: String? = null,
)

data class RegisteredGymDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "slug") val slug: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "publicCode") val publicCode: String? = null,
)

data class RegisteredGymOwnerDto(
    @Json(name = "email") val email: String? = null,
    @Json(name = "fullName") val fullName: String? = null,
)

data class RegisterGymResponseDto(
    @Json(name = "gym") val gym: RegisteredGymDto? = null,
    @Json(name = "owner") val owner: RegisteredGymOwnerDto? = null,
    @Json(name = "verification") val verification: VerificationIssueDto? = null,
    @Json(name = "approval") val approval: VerificationIssueDto? = null,
)

data class MyGymDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "publicCode") val publicCode: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "isActive") val isActive: Boolean = false,
    @Json(name = "joinedAt") val joinedAt: String? = null,
)

data class MyGymsDto(
    @Json(name = "activeGymId") val activeGymId: String? = null,
    @Json(name = "gyms") val gyms: List<MyGymDto> = emptyList(),
)

fun GymDto.toDomain(): Gym = Gym(
    id = id.orEmpty(),
    name = name.orEmpty(),
    publicCode = publicCode,
    status = status ?: "ACTIVE",
)

fun JoinGymResponseDto.toDomain(): JoinResult {
    val gym = gym?.toDomain() ?: error("El servidor no devolvió el gimnasio")
    return JoinResult(
        gym = gym,
        activeGymId = activeGymId?.takeIf { it.isNotBlank() } ?: gym.id,
        alreadyMember = alreadyMember,
    )
}

fun SwitchGymResponseDto.toDomain(): SwitchResult {
    val gym = gym?.toDomain() ?: error("El servidor no devolvió el gimnasio")
    return SwitchResult(
        gym = gym,
        activeGymId = activeGymId?.takeIf { it.isNotBlank() } ?: gym.id,
    )
}

fun MyGymDto.toDomain(): MyGym = MyGym(
    id = id.orEmpty(),
    name = name.orEmpty(),
    publicCode = publicCode,
    status = status ?: "ACTIVE",
    isActive = isActive,
    joinedAt = joinedAt,
)

fun MyGymsDto.toDomain(): MyGyms = MyGyms(
    activeGymId = activeGymId,
    gyms = gyms.map { it.toDomain() },
)

fun RegisterGymResponseDto.toDomain(): GymRegistrationResult = GymRegistrationResult(
    gymId = gym?.id.orEmpty(),
    gymName = gym?.name.orEmpty(),
    slug = gym?.slug?.takeIf { it.isNotBlank() },
    status = gym?.status?.takeIf { it.isNotBlank() },
    publicCode = gym?.publicCode?.takeIf { it.isNotBlank() },
    ownerEmail = owner?.email?.takeIf { it.isNotBlank() }.orEmpty(),
    ownerName = owner?.fullName?.takeIf { it.isNotBlank() }.orEmpty(),
    verificationEmail = verification?.email?.takeIf { it.isNotBlank() },
    verificationExpiresAt = verification?.expiresAt?.takeIf { it.isNotBlank() },
    verificationDevToken = verification?.devToken?.takeIf { it.isNotBlank() },
    verificationDevLink = verification?.devLink?.takeIf { it.isNotBlank() },
    approvalEmail = approval?.email?.takeIf { it.isNotBlank() },
    approvalExpiresAt = approval?.expiresAt?.takeIf { it.isNotBlank() },
    approvalDevToken = approval?.devToken?.takeIf { it.isNotBlank() },
    approvalDevLink = approval?.devLink?.takeIf { it.isNotBlank() },
)
