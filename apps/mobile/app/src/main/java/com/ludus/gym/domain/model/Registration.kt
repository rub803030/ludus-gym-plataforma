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

/** Alta pública de un gimnasio: el dueño se registra y queda pendiente de verificación. */
data class RegisterGymInput(
    val gymName: String,
    val slug: String = "",
    val ownerName: String,
    val email: String,
    val password: String,
    val contactEmail: String,
    val phone: String,
    val address: String,
    val city: String,
    val state: String,
    val postalCode: String,
    val legalRepresentative: String,
    val rfc: String,
    val website: String = "",
    val socialMedia: String = "",
    val description: String = "",
    val branchCount: String = "",
    val timezone: String = "",
    val capacity: String = "",
    val currency: String = "MXN",
    val openingHours: String = "",
)

data class GymRegistrationResult(
    val gymId: String,
    val gymName: String,
    val slug: String? = null,
    val status: String? = null,
    val publicCode: String? = null,
    val ownerEmail: String,
    val ownerName: String,
    val verificationEmail: String? = null,
    val verificationExpiresAt: String? = null,
    val verificationDevToken: String? = null,
    val verificationDevLink: String? = null,
    val approvalEmail: String? = null,
    val approvalExpiresAt: String? = null,
    val approvalDevToken: String? = null,
    val approvalDevLink: String? = null,
)
