package com.ludus.gym.data.remote.dto

import com.squareup.moshi.Json

data class LoginRequestDto(
    @Json(name = "email") val email: String,
    @Json(name = "password") val password: String,
    @Json(name = "platform") val platform: String = "mobile",
)

data class LoginResponseDto(
    @Json(name = "accessToken") val accessToken: String? = null,
    @Json(name = "refreshToken") val refreshToken: String? = null,
    @Json(name = "principal") val principal: PrincipalDto? = null,
    @Json(name = "token") val token: String? = null,
)

data class PrincipalDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "memberId") val memberId: String? = null,
    @Json(name = "sub") val sub: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "role") val role: String? = null,
    @Json(name = "membershipStatus") val membershipStatus: String? = null,
    @Json(name = "gymId") val gymId: String? = null,
    @Json(name = "activeGymId") val activeGymId: String? = null,
) {
    fun identifier(): String? = memberId ?: id ?: sub

    fun currentGymId(): String? = activeGymId ?: gymId
}

data class RefreshRequestDto(
    @Json(name = "refreshToken") val refreshToken: String,
)

data class RefreshResponseDto(
    @Json(name = "accessToken") val accessToken: String? = null,
    @Json(name = "refreshToken") val refreshToken: String? = null,
)

data class TokenPairDto(
    @Json(name = "accessToken") val accessToken: String? = null,
    @Json(name = "refreshToken") val refreshToken: String? = null,
)

data class MeDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "memberId") val memberId: String? = null,
    @Json(name = "sub") val sub: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "membershipStatus") val membershipStatus: String? = null,
    @Json(name = "planName") val planName: String? = null,
    @Json(name = "daysRemaining") val daysRemaining: Int? = null,
    @Json(name = "gymId") val gymId: String? = null,
    @Json(name = "activeGymId") val activeGymId: String? = null,
) {
    fun identifier(): String? = memberId ?: id ?: sub
}

data class ApiErrorDto(
    @Json(name = "code") val code: String? = null,
    @Json(name = "message") val message: String? = null,
    @Json(name = "error") val error: String? = null,
    @Json(name = "details") val details: Map<String, Any?>? = null,
    @Json(name = "statusCode") val statusCode: Int? = null,
)

data class ApiErrorEnvelopeDto(
    @Json(name = "error") val error: ApiErrorDto? = null,
)

data class VerifyEmailRequestDto(
    @Json(name = "token") val token: String,
)

data class ResendVerificationRequestDto(
    @Json(name = "email") val email: String,
    @Json(name = "platform") val platform: String = "mobile",
)

data class VerifyEmailResponseDto(
    @Json(name = "ok") val ok: Boolean = false,
    @Json(name = "email") val email: String? = null,
    @Json(name = "platform") val platform: String? = null,
    @Json(name = "name") val name: String? = null,
)

data class RegisterMemberRequestDto(
    @Json(name = "firstName") val firstName: String,
    @Json(name = "lastName") val lastName: String,
    @Json(name = "email") val email: String,
    @Json(name = "password") val password: String,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "documentNumber") val documentNumber: String? = null,
    @Json(name = "birthDate") val birthDate: String? = null,
)

data class RegisteredMemberDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "code") val code: String? = null,
    @Json(name = "email") val email: String? = null,
)

data class VerificationIssueDto(
    @Json(name = "email") val email: String? = null,
    @Json(name = "expiresAt") val expiresAt: String? = null,
    @Json(name = "devToken") val devToken: String? = null,
    @Json(name = "devLink") val devLink: String? = null,
)

data class RegisterMemberResponseDto(
    @Json(name = "member") val member: RegisteredMemberDto? = null,
    @Json(name = "verification") val verification: VerificationIssueDto? = null,
)
