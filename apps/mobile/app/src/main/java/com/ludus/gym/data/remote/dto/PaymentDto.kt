package com.ludus.gym.data.remote.dto

import com.ludus.gym.domain.model.Receipt
import com.squareup.moshi.Json

data class PaymentDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "concept") val concept: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "amount") val amount: Double? = null,
    @Json(name = "date") val date: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "status") val status: String? = null,
) {
    fun toDomain(index: Int) = Receipt(
        id = id ?: "receipt-$index",
        concept = concept ?: description ?: "Membresía Ludus",
        amount = amount ?: 0.0,
        date = date ?: createdAt.orEmpty(),
        status = status ?: "Pagado",
    )
}
