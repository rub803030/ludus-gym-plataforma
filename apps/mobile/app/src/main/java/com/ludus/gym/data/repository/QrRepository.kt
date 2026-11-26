package com.ludus.gym.data.repository

import com.ludus.gym.data.local.AccessEventEntity
import com.ludus.gym.data.local.LudusDao
import com.ludus.gym.data.local.QrCredentialEntity
import com.ludus.gym.data.local.TokenProvider
import com.ludus.gym.data.remote.ApiErrorMessages
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.NetworkStatus
import com.ludus.gym.data.remote.dto.QrTokenDto
import com.ludus.gym.data.remote.dto.QrTokenRequestDto
import com.ludus.gym.domain.model.QrPayload
import com.ludus.gym.domain.model.QrTicket
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.IOException
import java.time.Instant
import java.util.UUID

class QrRepository(
    private val api: ApiService,
    private val dao: LudusDao,
    private val tokens: TokenProvider,
    private val network: NetworkStatus,
) {
    private val _ticket = MutableStateFlow<QrTicket?>(null)
    val ticket: StateFlow<QrTicket?> = _ticket.asStateFlow()

    /**
     * Con red: pide un pase nuevo para el gimnasio activo y guarda la credencial
     * offline firmada por la API. Sin red: reutiliza esa credencial guardada.
     * El teléfono nunca re-firma ni modifica el token copiado.
     */
    suspend fun refresh(): Result<QrTicket> {
        val now = System.currentTimeMillis()
        val activeGymId = tokens.activeGymId()
        val dto = if (network.isOnline()) {
            try {
                api.qrToken(QrTokenRequestDto(gymId = activeGymId))
            } catch (error: CancellationException) {
                throw error
            } catch (error: IOException) {
                return offlineTicket(now, activeGymId, networkFailure = error)
            } catch (error: Exception) {
                _ticket.value = null
                return Result.failure(error)
            }
        } else {
            return offlineTicket(now, activeGymId)
        }
        dto.offlineCredential?.let { cacheOfflineCredential(it, now) }
        val value = dto.value()?.takeIf { it.isNotBlank() }
        if (value == null) {
            _ticket.value = null
            return Result.failure(IllegalStateException("La API no devolvió un pase QR válido. Inténtalo de nuevo."))
        }

        val gymId = dto.gymId?.takeIf { it.isNotBlank() }
            ?: QrPayload.parse(value)?.gymId?.takeIf { it.isNotBlank() }
            ?: activeGymId
        val live = QrTicket(
            token = value,
            validUntilMillis = expiryMillis(dto, now),
            offline = false,
            serverExpiresAt = dto.expiresAt,
            gymId = gymId,
        )
        _ticket.value = live
        return Result.success(live)
    }

    private suspend fun offlineTicket(
        now: Long,
        activeGymId: String?,
        networkFailure: IOException? = null,
    ): Result<QrTicket> {
        val cached = dao.qrCredential()?.takeIf {
            it.expiresAtMillis > now &&
                QrPayload.isOfflineCredential(it.raw, now) &&
                (activeGymId.isNullOrBlank() || it.gymId == activeGymId)
        }
        if (cached == null) {
            _ticket.value = null
            return Result.failure(
                networkFailure ?: IllegalStateException("Sin conexión y sin pase offline guardado para este gimnasio"),
            )
        }
        val offline = QrTicket(
            token = cached.raw,
            validUntilMillis = cached.expiresAtMillis,
            offline = true,
            gymId = cached.gymId ?: QrPayload.parse(cached.raw)?.gymId,
        )
        _ticket.value = offline
        return Result.success(offline)
    }

    fun current(): QrTicket? = _ticket.value

    /** Comprobación local solo para la interfaz; el lector vuelve a verificar. */
    fun verifyLocally(payload: String): Boolean = QrPayload.isOfflineCredential(payload)

    suspend fun offlineCredential(): QrCredentialEntity? {
        val now = System.currentTimeMillis()
        val activeGymId = tokens.activeGymId()
        dao.qrCredential()?.takeIf {
            QrPayload.isOfflineCredential(it.raw, now) &&
                (activeGymId.isNullOrBlank() || it.gymId == activeGymId)
        }?.let { return it }
        val dto = if (network.isOnline()) {
            try {
                api.qrToken(QrTokenRequestDto(gymId = activeGymId))
            } catch (_: IOException) {
                return null
            }
        } else {
            null
        }
        val raw = dto?.offlineCredential ?: return null
        return cacheOfflineCredential(raw, now)
    }

    private suspend fun cacheOfflineCredential(raw: String, nowMillis: Long): QrCredentialEntity? {
        val parsed = QrPayload.parse(raw) ?: return null
        if (parsed.kind != "offline" || parsed.expiresAtMillis <= nowMillis) return null
        val credential = QrCredentialEntity(
            memberId = parsed.memberId.ifBlank { tokens.memberId().orEmpty() },
            expiresAtMillis = parsed.expiresAtMillis,
            raw = raw,
            cachedAt = nowMillis,
            gymId = parsed.gymId.takeIf { it.isNotBlank() },
        )
        dao.saveQrCredential(credential)
        return credential
    }

    suspend fun recordAccessScan(token: String) {
        dao.insertAccessEvent(
            AccessEventEntity(
                id = UUID.randomUUID().toString(),
                memberId = tokens.memberId() ?: "member-demo",
                token = token,
                scannedAt = System.currentTimeMillis(),
            ),
        )
    }

    fun readableError(error: Throwable): String = ApiErrorMessages.readable(error)

    private fun expiryMillis(dto: QrTokenDto, nowMillis: Long): Long {
        dto.expiresAt?.let { raw ->
            runCatching { Instant.parse(raw).toEpochMilli() }.getOrNull()?.let { return it }
        }
        val seconds = dto.expiresIn ?: dto.validForSeconds ?: 30L
        return nowMillis + seconds.coerceIn(1L, 3600L) * 1000L
    }
}
