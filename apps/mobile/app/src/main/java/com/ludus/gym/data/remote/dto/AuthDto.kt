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
) {
    fun identifier(): String? = memberId ?: id ?: sub
}

data class RefreshRequestDto(
    @Json(name = "refreshToken") val refreshToken: String,
)

data class RefreshResponseDto(
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
) {
    fun identifier(): String? = memberId ?: id ?: sub
}

data class ApiErrorDto(
    @Json(name = "message") val message: String? = null,
    @Json(name = "error") val error: String? = null,
    @Json(name = "statusCode") val statusCode: Int? = null,
)
