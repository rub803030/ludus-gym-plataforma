package com.ludus.gym.domain.model

import java.util.Base64

/**
 * Los códigos de acceso son JSON codificado en base64url y firmado con HMAC
 * por la API (`QR_HMAC_SECRET`). El teléfono nunca conoce el secreto: solo
 * muestra el token y, mientras tiene conexión, guarda la credencial offline
 * que la propia API emite junto con él (`kind = "offline"`, vigente 10 min).
 *
 * Este objeto solo interpreta el contenido para la cuenta regresiva y para
 * decidir si una credencial guardada sigue siendo válida. La validación
 * definitiva la hace siempre el lector en `/api/access/verify-qr`.
 */
object QrPayload {
    const val OFFLINE_VALID_SECONDS = 600L

    fun parse(raw: String): ParsedQr? {
        val json = runCatching {
            String(Base64.getUrlDecoder().decode(raw), Charsets.UTF_8)
        }.getOrNull() ?: return null

        val expiresAtMillis = numberField(json, "exp")
        if (expiresAtMillis <= 0L) return null
        return ParsedQr(
            raw = raw,
            memberId = stringField(json, "memberId"),
            expiresAtMillis = expiresAtMillis,
            kind = stringField(json, "kind"),
        )
    }

    /** El payload de la API es plano; estos campos no contienen comillas escapadas. */
    private fun stringField(json: String, name: String): String =
        Regex("\"$name\"\\s*:\\s*\"([^\"]*)\"").find(json)?.groupValues?.get(1).orEmpty()

    private fun numberField(json: String, name: String): Long =
        Regex("\"$name\"\\s*:\\s*(-?\\d+)").find(json)?.groupValues?.get(1)?.toLongOrNull() ?: -1L

    /** Pase offline emitido por el servidor y aún dentro de su ventana. */
    fun isOfflineCredential(raw: String, nowMillis: Long = System.currentTimeMillis()): Boolean {
        val parsed = parse(raw) ?: return false
        return parsed.kind == "offline" && parsed.expiresAtMillis > nowMillis
    }

    /** Pase rotante normal (sin `kind`) emitido por el servidor. */
    fun isLiveTicket(raw: String, nowMillis: Long = System.currentTimeMillis()): Boolean {
        val parsed = parse(raw) ?: return false
        return parsed.kind.isEmpty() && parsed.expiresAtMillis > nowMillis
    }
}

data class ParsedQr(
    val raw: String,
    val memberId: String,
    val expiresAtMillis: Long,
    val kind: String,
)

data class QrTicket(
    val token: String,
    val validUntilMillis: Long,
    val offline: Boolean = false,
    val serverExpiresAt: String? = null,
) {
    fun secondsRemaining(nowMillis: Long = System.currentTimeMillis()): Long =
        ((validUntilMillis - nowMillis) / 1000L).coerceAtLeast(0L)

    fun isExpired(nowMillis: Long = System.currentTimeMillis()): Boolean = nowMillis >= validUntilMillis
}
