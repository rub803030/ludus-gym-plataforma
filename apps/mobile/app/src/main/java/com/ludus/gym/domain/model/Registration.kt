package com.ludus.gym.domain.model

data class RegisterMemberInput(
    val firstName: String,
    val lastName: String,
    val email: String,
    val password: String,
    val phone: String? = null,
    val documentNumber: String? = null,
    val birthDate: String? = null,
)

data class RegistrationResult(
    val memberId: String,
    val code: String? = null,
    val email: String,
    val expiresAt: String? = null,
    val devToken: String? = null,
    val devLink: String? = null,
)
