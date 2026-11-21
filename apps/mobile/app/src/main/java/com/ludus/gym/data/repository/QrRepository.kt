package com.ludus.gym.data.repository

import com.ludus.gym.data.local.AccessEventEntity
import com.ludus.gym.data.local.LudusDao
import com.ludus.gym.data.local.QrCredentialEntity
import com.ludus.gym.data.local.TokenProvider
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.NetworkMonitor
import com.ludus.gym.data.remote.dto.QrTokenDto
import com.ludus.gym.domain.model.QrPayload
import com.ludus.gym.domain.model.QrTicket
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Instant
import java.util.UUID

class QrRepository(
    private val api: ApiService,
    private val dao: LudusDao,
    private val tokens: TokenProvider,
    private val network: NetworkMonitor,
) {
    private val _ticket = MutableStateFlow<QrTicket?>(null)
    val ticket: StateFlow<QrTicket?> = _ticket.asStateFlow()

    /**
     * Con red: pide un pase nuevo y guarda la credencial offline firmada por
     * la API. Sin red: reutiliza esa credencial guardada, que el lector sí
     * acepta porque lleva la firma del servidor.
     */
    suspend fun refresh(): Result<QrTicket> {
        val now = System.currentTimeMillis()
        val dto = if (network.isOnline()) runCatching { api.qrToken() }.getOrNull() else null
        if (dto != null) {
            val value = dto.value()
            if (!value.isNullOrBlank()) {
                dto.offlineCredential?.let { cacheOfflineCredential(it, now) }
                val live = QrTicket(
                    token = value,
                    validUntilMillis = expiryMillis(dto, now),
                    offline = false,
                    serverExpiresAt = dto.expiresAt,
                )
                _ticket.value = live
                return Result.success(live)
            }
        }

        val cached = dao.qrCredential()?.takeIf {
            it.expiresAtMillis > now && QrPayload.isOfflineCredential(it.raw, now)
        }
        if (cached == null) {
            _ticket.value = null
            return Result.failure(IllegalStateException("Sin conexión y sin pase offline guardado"))
        }
        val offline = QrTicket(
            token = cached.raw,
            validUntilMillis = cached.expiresAtMillis,
            offline = true,
        )
        _ticket.value = offline
        return Result.success(offline)
    }

    fun current(): QrTicket? = _ticket.value

    /** Comprobación local solo para la interfaz; el lector vuelve a verificar. */
    fun verifyLocally(payload: String): Boolean = QrPayload.isOfflineCredential(payload)

    suspend fun offlineCredential(): QrCredentialEntity? {
        val now = System.currentTimeMillis()
        dao.qrCredential()?.takeIf { QrPayload.isOfflineCredential(it.raw, now) }?.let { return it }
        val dto = if (network.isOnline()) runCatching { api.qrToken() }.getOrNull() else null
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

    private fun expiryMillis(dto: QrTokenDto, nowMillis: Long): Long {
        dto.expiresAt?.let { raw ->
            runCatching { Instant.parse(raw).toEpochMilli() }.getOrNull()?.let { return it }
        }
        val seconds = dto.expiresIn ?: dto.validForSeconds ?: 30L
        return nowMillis + seconds.coerceIn(1L, 3600L) * 1000L
    }
}
