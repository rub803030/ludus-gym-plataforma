package com.ludus.gym.data.remote.dto

import com.squareup.moshi.Json

data class QrTokenDto(
    @Json(name = "token") val token: String? = null,
    @Json(name = "qrToken") val qrToken: String? = null,
    @Json(name = "expiresAt") val expiresAt: String? = null,
    @Json(name = "expiresIn") val expiresIn: Long? = null,
    @Json(name = "validForSeconds") val validForSeconds: Long? = null,
) {
    fun value(): String? = token ?: qrToken
}

data class OccupancyDto(
    @Json(name = "current") val current: Int? = null,
    @Json(name = "count") val count: Int? = null,
    @Json(name = "capacity") val capacity: Int? = null,
    @Json(name = "maxCapacity") val maxCapacity: Int? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null,
)

data class AccessEventRequestDto(
    @Json(name = "memberId") val memberId: String,
    @Json(name = "token") val token: String,
    @Json(name = "scannedAt") val scannedAt: Long,
)
