package com.ludus.gym.domain.model

import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Formato del código QR de acceso:
 *
 *   LUDUS1|<memberId>|<bucket>|<expiresAtEpochSeconds>|<firmaBase64Url>
 *
 * El bucket es de 30 segundos, de modo que el código rota aunque el reloj del
 * servidor y el del teléfono difieran unos segundos. La firma HMAC-SHA256 se
 * calcula sobre los cuatro primeros campos.
 *
 * SEGURIDAD: DEV_SECRET solo se usa para la credencial offline de demostración.
 * No es secreto: está compilado en la app. En producción el token debe venir
 * siempre de POST /api/access/qr-token y la validación la hace el lector.
 */
object QrPayload {
    const val VERSION = "LUDUS1"
    const val BUCKET_SECONDS: Long = 30L
    const val OFFLINE_VALID_SECONDS: Long = 600L
    const val DEV_SECRET = "ludus-mobile-offline-demo-secret-v1"

    fun bucketOf(epochSeconds: Long): Long = Math.floorDiv(epochSeconds, BUCKET_SECONDS)

    fun sign(memberId: String, bucket: Long, expiresAt: Long, secret: String = DEV_SECRET): String {
        val message = listOf(VERSION, memberId, bucket.toString(), expiresAt.toString()).joinToString("|")
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return encodeUrl(mac.doFinal(message.toByteArray(Charsets.UTF_8)))
    }

    fun build(memberId: String, expiresAt: Long, secret: String = DEV_SECRET, nowSeconds: Long = System.currentTimeMillis() / 1000L): String {
        val bucket = bucketOf(nowSeconds)
        val signature = sign(memberId, bucket, expiresAt, secret)
        return listOf(VERSION, memberId, bucket.toString(), expiresAt.toString(), signature).joinToString("|")
    }

    fun parse(raw: String): ParsedQr? {
        val parts = raw.split('|')
        if (parts.size != 5 || parts[0] != VERSION) return null
        val memberId = parts[1]
        if (memberId.isBlank()) return null
        val bucket = parts[2].toLongOrNull() ?: return null
        val expiresAt = parts[3].toLongOrNull() ?: return null
        val signature = parts[4]
        if (signature.isBlank()) return null
        return ParsedQr(raw, memberId, bucket, expiresAt, signature)
    }

    fun verify(parsed: ParsedQr, secret: String = DEV_SECRET): Boolean {
        val expected = sign(parsed.memberId, parsed.bucket, parsed.expiresAt, secret)
        return constantTimeEquals(expected.toByteArray(Charsets.UTF_8), parsed.signature.toByteArray(Charsets.UTF_8))
    }

    fun isValidAt(parsed: ParsedQr, nowSeconds: Long, secret: String = DEV_SECRET, verifySignature: Boolean = true): Boolean {
        if (parsed.expiresAt <= nowSeconds) return false
        if (parsed.bucket != bucketOf(nowSeconds)) return false
        if (verifySignature && !verify(parsed, secret)) return false
        return true
    }

    private fun encodeUrl(bytes: ByteArray): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)

    private fun constantTimeEquals(a: ByteArray, b: ByteArray): Boolean {
        if (a.size != b.size) return false
        var diff = 0
        for (i in a.indices) diff = diff or (a[i].toInt() xor b[i].toInt())
        return diff == 0 && MessageDigest.isEqual(a, b)
    }
}

data class ParsedQr(
    val raw: String,
    val memberId: String,
    val bucket: Long,
    val expiresAt: Long,
    val signature: String,
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
