package com.ludus.gym.data.remote

import com.ludus.gym.data.local.TokenProvider
import com.ludus.gym.data.remote.dto.RefreshRequestDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Ante un 401: si otro hilo ya refrescó el token, reintenta con el nuevo;
 * si no, hace una única llamada de refresh con el refresh token y reintenta.
 * Si el refresh falla, cierra la sesión para volver al login.
 */
class TokenAuthenticator(
    private val tokens: TokenProvider,
    private val refreshApi: RefreshApiService,
) : Authenticator {

    private val lock = ReentrantLock()

    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.request.header("Authorization") == null) return null
        val failedToken = response.request.header("Authorization")?.removePrefix("Bearer ")?.trim()

        return lock.withLock {
            val current = tokens.currentAccessToken()
            if (!current.isNullOrBlank() && current != failedToken) {
                return@withLock response.request.newBuilder()
                    .header("Authorization", "Bearer $current")
                    .build()
            }

            val refreshToken = tokens.currentRefreshToken()
            if (refreshToken.isNullOrBlank()) {
                tokens.clearSession()
                return@withLock null
            }

            val refreshed = runCatching {
                runBlocking(Dispatchers.IO) {
                    val request = RefreshRequestDto(refreshToken)
                    runCatching { refreshApi.refresh(request) }
                        .recoverCatching { refreshApi.refreshMobile(request) }
                        .getOrNull()
                }
            }.getOrNull()

            val newAccessToken = refreshed?.accessToken
            if (newAccessToken.isNullOrBlank()) {
                tokens.clearSession()
                return@withLock null
            }

            tokens.saveTokens(
                accessToken = newAccessToken,
                refreshToken = refreshed.refreshToken?.takeIf { it.isNotBlank() } ?: refreshToken,
                memberId = tokens.memberId().orEmpty(),
            )
            response.request.newBuilder()
                .header("Authorization", "Bearer $newAccessToken")
                .build()
        }
    }
}
