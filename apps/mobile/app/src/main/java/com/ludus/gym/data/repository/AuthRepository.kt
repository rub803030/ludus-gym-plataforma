package com.ludus.gym.data.repository

import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.data.local.SecureTokenStore
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.NetworkMonitor
import com.ludus.gym.data.remote.dto.LoginRequestDto
import com.ludus.gym.domain.model.Member
import com.ludus.gym.domain.model.MembershipStatus
import com.ludus.gym.domain.model.Session
import kotlinx.coroutines.flow.StateFlow

class AuthRepository(
    private val api: ApiService,
    private val tokens: SecureTokenStore,
    private val members: MemberRepository,
    private val network: NetworkMonitor,
) {
    val session: StateFlow<Session?> = tokens.session

    fun isLoggedIn(): Boolean = tokens.hasSession()

    fun deviceId(): String = tokens.deviceId()

    suspend fun login(email: String, password: String): Result<Member> = runCatching {
        try {
            val response = api.login(LoginRequestDto(email.trim(), password, "mobile"))
            val access = response.accessToken ?: response.token
            if (access.isNullOrBlank()) error("El servidor no devolvió un token de acceso")
            val memberId = response.principal?.identifier() ?: "member-demo"
            tokens.saveTokens(
                accessToken = access,
                refreshToken = response.refreshToken?.takeIf { it.isNotBlank() } ?: "refresh-$access",
                memberId = memberId,
            )
            val member = response.principal?.toDomain(memberId, email)
                ?: members.cachedMe(memberId)
            runCatching { members.refreshProfile(memberId) }
            member
        } catch (error: Exception) {
            // Sin backend y con las credenciales de demo: sesión local de demostración.
            if (!network.isOnline() &&
                email.trim().equals(DemoCatalog.DEMO_EMAIL, ignoreCase = true) &&
                password == DemoCatalog.DEMO_PASSWORD
            ) {
                tokens.saveTokens("offline-demo-token", "offline-demo-refresh", "member-demo")
                val member = DemoCatalog.member.copy(email = email.trim())
                members.cache(member)
                member
            } else {
                throw error
            }
        }
    }

    suspend fun logout() {
        tokens.clearSession()
    }

    suspend fun refreshProfile(): Result<Member> = members.refreshProfile(tokens.memberId())

    fun currentMemberId(): String? = tokens.memberId()

    private fun com.ludus.gym.data.remote.dto.PrincipalDto.toDomain(id: String, email: String) = Member(
        id = id,
        name = name ?: email,
        email = this.email ?: email,
        membershipStatus = when {
            membershipStatus?.contains("pend", true) == true -> MembershipStatus.PENDING
            membershipStatus?.contains("inactive", true) == true -> MembershipStatus.INACTIVE
            else -> MembershipStatus.ACTIVE
        },
        planName = "Ludus Pro",
        daysRemaining = 28,
    )
}
