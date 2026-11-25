package com.ludus.gym.data.repository

import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.data.local.LudusDao
import com.ludus.gym.data.local.SecureTokenStore
import com.ludus.gym.data.remote.ApiErrorMessages
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.NetworkMonitor
import com.ludus.gym.data.remote.dto.LoginRequestDto
import com.ludus.gym.data.remote.dto.ResendVerificationRequestDto
import com.ludus.gym.data.remote.dto.VerifyEmailRequestDto
import com.ludus.gym.domain.model.EmailNotVerifiedException
import com.ludus.gym.domain.model.Member
import com.ludus.gym.domain.model.MembershipStatus
import com.ludus.gym.domain.model.Session
import kotlinx.coroutines.flow.StateFlow
import retrofit2.HttpException
import java.net.URLDecoder

class AuthRepository(
    private val api: ApiService,
    private val tokens: SecureTokenStore,
    private val members: MemberRepository,
    private val network: NetworkMonitor,
    private val dao: LudusDao,
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
            val activeGymId = response.principal?.currentGymId()
            tokens.saveTokens(
                accessToken = access,
                refreshToken = response.refreshToken?.takeIf { it.isNotBlank() } ?: "refresh-$access",
                memberId = memberId,
                activeGymId = activeGymId,
            )
            val member = response.principal?.toDomain(memberId, email, activeGymId)
                ?: members.cachedMe(memberId)
            runCatching { members.refreshProfile(memberId) }
            member
        } catch (error: Exception) {
            if (error is HttpException && error.code() == 403 && ApiErrorMessages.code(error) == "EMAIL_NOT_VERIFIED") {
                throw EmailNotVerifiedException(email.trim())
            }
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

    suspend fun verifyEmail(token: String): Result<String> = runCatching {
        val response = api.verifyEmail(VerifyEmailRequestDto(normalizeToken(token)))
        if (!response.ok) error("No fue posible confirmar el correo")
        response.email.orEmpty()
    }

    suspend fun resendVerification(email: String): Result<Unit> = runCatching {
        api.resendVerification(ResendVerificationRequestDto(email.trim()))
        Unit
    }

    suspend fun logout() {
        dao.clearActiveGym()
        dao.clearGyms()
        tokens.clearSession()
    }

    suspend fun refreshProfile(): Result<Member> = members.refreshProfile(tokens.memberId())

    fun currentMemberId(): String? = tokens.memberId()

    private fun com.ludus.gym.data.remote.dto.PrincipalDto.toDomain(
        id: String,
        email: String,
        gymId: String?,
    ) = Member(
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
        activeGymId = gymId,
    )

    private fun normalizeToken(value: String): String {
        val trimmed = value.trim()
        val token = Regex("(?:[?&]token=)([^&#\\s]+)").find(trimmed)?.groupValues?.get(1) ?: trimmed
        @Suppress("DEPRECATION")
        return URLDecoder.decode(token, "UTF-8")
    }
}
