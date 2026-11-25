package com.ludus.gym.domain.model

data class Gym(
    val id: String,
    val name: String,
    val publicCode: String? = null,
    val status: String = "ACTIVE",
)

data class MyGym(
    val id: String,
    val name: String,
    val publicCode: String? = null,
    val status: String = "ACTIVE",
    val isActive: Boolean = false,
    val joinedAt: String? = null,
)

data class MyGyms(
    val activeGymId: String?,
    val gyms: List<MyGym> = emptyList(),
)

data class JoinResult(
    val gym: Gym,
    val activeGymId: String,
    val alreadyMember: Boolean = false,
)

data class SwitchResult(
    val gym: Gym,
    val activeGymId: String,
)
