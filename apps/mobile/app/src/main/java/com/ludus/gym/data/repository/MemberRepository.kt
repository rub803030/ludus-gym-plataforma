package com.ludus.gym.data.repository

import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.data.local.LudusDao
import com.ludus.gym.data.local.MemberEntity
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.dto.MeDto
import com.ludus.gym.data.remote.dto.MemberDto
import com.ludus.gym.data.remote.dto.parseMembershipStatus
import com.ludus.gym.data.remote.dto.toDomain
import com.ludus.gym.domain.model.Member
import com.ludus.gym.domain.model.Occupancy
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class MemberRepository(
    private val api: ApiService,
    private val dao: LudusDao,
) {
    fun observeMe(): Flow<Member?> = dao.observeMember().map { it?.toDomain() }

    suspend fun cachedMe(fallbackId: String? = null): Member =
        dao.member(fallbackId ?: "member-demo")?.toDomain()
            ?: DemoCatalog.member.copy(id = fallbackId ?: "member-demo")

    suspend fun cache(member: Member) {
        dao.saveMember(
            MemberEntity(
                id = member.id,
                name = member.name,
                email = member.email,
                membershipStatus = member.membershipStatus.name,
                planName = member.planName,
                daysRemaining = member.daysRemaining,
                gymId = member.activeGymId,
                cachedAt = System.currentTimeMillis(),
            ),
        )
    }

    suspend fun refreshProfile(fallbackId: String? = null): Result<Member> = runCatching {
        val member = loadFromApi(fallbackId)
        cache(member)
        member
    }

    private suspend fun loadFromApi(fallbackId: String?): Member {
        val me: MeDto? = runCatching { api.me() }.getOrNull()
        if (me != null && (me.identifier() != null || !me.name.isNullOrBlank())) {
            return me.toDomain(fallbackId)
        }
        val memberDto: MemberDto? = runCatching { api.memberMe() }.getOrNull()
            ?: runCatching { api.members().firstOrNull() }.getOrNull()
        if (memberDto != null) return memberDto.toDomain(fallbackId)
        return DemoCatalog.member.copy(id = fallbackId ?: "member-demo")
    }

    suspend fun occupancy(): Result<Occupancy> = runCatching {
        val dto = api.occupancy()
        Occupancy(
            current = dto.current ?: dto.count ?: DemoCatalog.occupancy.current,
            capacity = dto.capacity ?: dto.maxCapacity ?: DemoCatalog.occupancy.capacity,
            updatedAt = dto.updatedAt ?: "actualizado ahora",
        )
    }.recoverCatching { DemoCatalog.occupancy }

    private fun MemberEntity.toDomain(): Member = Member(
        id = id,
        name = name,
        email = email,
        membershipStatus = parseMembershipStatus(membershipStatus),
        planName = planName,
        daysRemaining = daysRemaining,
        activeGymId = gymId,
    )
}

private fun MeDto.toDomain(fallbackId: String?): Member {
    val name = name ?: email ?: "Socio Ludus"
    return Member(
        id = identifier() ?: fallbackId ?: "member-demo",
        name = name,
        email = email.orEmpty(),
        membershipStatus = parseMembershipStatus(membershipStatus),
        planName = planName ?: "Ludus Pro",
        daysRemaining = daysRemaining ?: 28,
        activeGymId = activeGymId ?: gymId,
    )
}
