package com.ludus.gym.data.remote.dto

import com.ludus.gym.domain.model.Member
import com.ludus.gym.domain.model.MembershipStatus
import com.squareup.moshi.Json

data class MemberDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "memberId") val memberId: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "fullName") val fullName: String? = null,
    @Json(name = "membershipStatus") val membershipStatus: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "planName") val planName: String? = null,
    @Json(name = "plan") val plan: String? = null,
    @Json(name = "daysRemaining") val daysRemaining: Int? = null,
    @Json(name = "gymId") val gymId: String? = null,
    @Json(name = "activeGymId") val activeGymId: String? = null,
) {
    fun identifier(): String? = id ?: memberId
}

fun parseMembershipStatus(value: String?): MembershipStatus {
    if (value.isNullOrBlank()) return MembershipStatus.ACTIVE
    val v = value.lowercase()
    return when {
        v.contains("pend") || v.contains("moros") || v.contains("debt") || v.contains("overdue") -> MembershipStatus.PENDING
        v.contains("inactive") || v.contains("cancel") || v.contains("baja") -> MembershipStatus.INACTIVE
        else -> MembershipStatus.ACTIVE
    }
}

fun MemberDto.toDomain(fallbackId: String? = null): Member {
    val displayName = name ?: fullName ?: email ?: "Socio Ludus"
    return Member(
        id = identifier() ?: fallbackId ?: "member-demo",
        name = displayName,
        email = email.orEmpty(),
        membershipStatus = parseMembershipStatus(membershipStatus ?: status),
        planName = planName ?: plan ?: "Ludus Pro",
        daysRemaining = daysRemaining ?: 28,
        activeGymId = activeGymId ?: gymId,
    )
}
