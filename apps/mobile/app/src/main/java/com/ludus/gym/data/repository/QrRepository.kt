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

    /** Pide el token rotante al servidor; si no hay red usa la credencial offline. */
    suspend fun refresh(): Result<QrTicket> {
        val nowMillis = System.currentTimeMillis()
        val dto: QrTokenDto? = if (network.isOnline()) runCatching { api.qrToken() }.getOrNull() else null
        val value = dto?.value()

        if (!value.isNullOrBlank()) {
            val result = QrTicket(
                token = value,
                validUntilMillis = expiryMillis(dto, nowMillis),
                offline = false,
                serverExpiresAt = dto.expiresAt,
            )
            _ticket.value = result
            return Result.success(result)
        }

        val offline = offlineCredential()
        val result = QrTicket(
            token = offline.raw,
            validUntilMillis = offline.expiresAt * 1000L,
            offline = true,
        )
        _ticket.value = result
        return Result.success(result)
    }

    fun current(): QrTicket? = _ticket.value

    /** Valida únicamente credenciales offline (formato LUDUS1 + firma + ventana). */
    fun verifyLocally(payload: String): Boolean {
        val parsed = QrPayload.parse(payload) ?: return false
        return QrPayload.isValidAt(
            parsed = parsed,
            nowSeconds = System.currentTimeMillis() / 1000L,
            secret = QrPayload.DEV_SECRET,
            verifySignature = true,
        )
    }

    suspend fun offlineCredential(): QrCredentialEntity {
        val now = System.currentTimeMillis() / 1000L
        val cached = dao.qrCredential()
        if (cached != null && cached.expiresAt > now + 5) {
            val parsed = QrPayload.parse(cached.raw)
            if (parsed != null && QrPayload.verify(parsed)) return cached
        }
        val memberId = tokens.memberId()?.takeIf { it.isNotBlank() } ?: "member-demo"
        val expiresAt = now + QrPayload.OFFLINE_VALID_SECONDS
        val raw = QrPayload.build(memberId, expiresAt, nowSeconds = now)
        val parsed = requireNotNull(QrPayload.parse(raw))
        val credential = QrCredentialEntity(
            memberId = memberId,
            bucket = parsed.bucket,
            expiresAt = parsed.expiresAt,
            signature = parsed.signature,
            raw = raw,
            createdAt = now,
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
