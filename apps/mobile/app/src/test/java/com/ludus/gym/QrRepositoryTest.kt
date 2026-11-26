package com.ludus.gym

import com.ludus.gym.data.local.LudusDao
import com.ludus.gym.data.local.QrCredentialEntity
import com.ludus.gym.data.local.TokenProvider
import com.ludus.gym.data.remote.NetworkStatus
import com.ludus.gym.data.remote.dto.QrTokenDto
import com.ludus.gym.data.remote.dto.QrTokenRequestDto
import com.ludus.gym.data.repository.QrRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException
import java.lang.reflect.Proxy
import java.util.Base64

class QrRepositoryTest {
    private val gymId = "gym-1"

    @Test
    fun `uses cached offline credential after a genuine network failure`() = runTest {
        val api = object : FakeApiService() {
            override suspend fun qrToken(request: QrTokenRequestDto): QrTokenDto {
                throw IOException("network unavailable")
            }
        }
        val repository = repository(api, online = true, credential = cachedCredential())

        val ticket = repository.refresh().getOrThrow()

        assertTrue(ticket.offline)
        assertEquals(gymId, ticket.gymId)
        assertEquals(ticket.token, repository.current()?.token)
    }

    @Test
    fun `uses cached offline credential when the device is offline`() = runTest {
        val repository = repository(FakeApiService(), online = false, credential = cachedCredential())

        val ticket = repository.refresh().getOrThrow()

        assertTrue(ticket.offline)
        assertEquals(gymId, ticket.gymId)
    }

    @Test
    fun `does not replace an API domain error with a cached offline ticket`() = runTest {
        val body = """{"error":{"code":"NO_GYM","message":"No gym membership"}}"""
            .toResponseBody("application/json".toMediaType())
        val error = HttpException(Response.error<QrTokenDto>(403, body))
        val api = object : FakeApiService() {
            override suspend fun qrToken(request: QrTokenRequestDto): QrTokenDto = throw error
        }
        val repository = repository(api, online = true, credential = cachedCredential())

        val result = repository.refresh()

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() === error)
        assertEquals("Únete a un gimnasio para continuar.", repository.readableError(error))
        assertNull(repository.current())
    }

    private fun repository(
        api: FakeApiService,
        online: Boolean,
        credential: QrCredentialEntity?,
    ): QrRepository = QrRepository(
        api = api,
        dao = fakeDao(credential),
        tokens = TestTokenProvider(gymId),
        network = NetworkStatus { online },
    )

    private fun cachedCredential(): QrCredentialEntity {
        val expiresAt = System.currentTimeMillis() + 600_000L
        val payload = """{"kind":"offline","exp":$expiresAt,"memberId":"member-1","gymId":"$gymId"}"""
        val raw = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(payload.toByteArray(Charsets.UTF_8))
        return QrCredentialEntity(
            memberId = "member-1",
            expiresAtMillis = expiresAt,
            raw = raw,
            cachedAt = System.currentTimeMillis(),
            gymId = gymId,
        )
    }

    private fun fakeDao(credential: QrCredentialEntity?): LudusDao =
        Proxy.newProxyInstance(
            LudusDao::class.java.classLoader,
            arrayOf(LudusDao::class.java),
        ) { _, method, _ ->
            when (method.name) {
                "qrCredential" -> credential
                "toString" -> "FakeLudusDao"
                "hashCode" -> System.identityHashCode(this)
                "equals" -> false
                else -> null
            }
        } as LudusDao

    private class TestTokenProvider(gymId: String) : TokenProvider {
        override val activeGym = MutableStateFlow<String?>(gymId)
        override fun currentAccessToken(): String? = null
        override fun currentRefreshToken(): String? = null
        override fun memberId(): String = "member-1"
        override fun activeGymId(): String? = activeGym.value
        override fun saveTokens(accessToken: String, refreshToken: String, memberId: String, activeGymId: String?) = Unit
        override fun saveActiveGymId(gymId: String?) {
            activeGym.value = gymId
        }
        override fun clearSession() {
            activeGym.value = null
        }
    }
}
