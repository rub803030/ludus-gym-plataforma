package com.ludus.gym.domain.usecase

import com.ludus.gym.data.repository.MemberRepository
import com.ludus.gym.domain.model.Member

class ObserveProfileUseCase(private val members: MemberRepository) {
    operator fun invoke() = members.observeMe()
}

class GetCachedProfileUseCase(private val members: MemberRepository) {
    suspend operator fun invoke(fallbackId: String? = null): Member = members.cachedMe(fallbackId)
}

class GetOccupancyUseCase(private val members: MemberRepository) {
    suspend operator fun invoke() = members.occupancy()
}
