package com.ludus.gym.domain.model

enum class MembershipStatus { ACTIVE, PENDING, INACTIVE }

data class Member(
    val id: String,
    val name: String,
    val email: String = "",
    val membershipStatus: MembershipStatus = MembershipStatus.ACTIVE,
    val planName: String = "Ludus Pro",
    val daysRemaining: Int = 0,
    val initials: String = name.take(2).uppercase(),
) {
    val isActive: Boolean get() = membershipStatus == MembershipStatus.ACTIVE
}

data class Occupancy(
    val current: Int = 0,
    val capacity: Int = 1,
    val updatedAt: String = "",
) {
    val ratio: Float get() = (current.toFloat() / capacity.coerceAtLeast(1)).coerceIn(0f, 1f)
}

data class Session(
    val accessToken: String,
    val refreshToken: String,
    val memberId: String,
)
