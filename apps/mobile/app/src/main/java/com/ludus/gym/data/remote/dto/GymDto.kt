package com.ludus.gym.data.remote.dto

import com.ludus.gym.domain.model.Gym
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
